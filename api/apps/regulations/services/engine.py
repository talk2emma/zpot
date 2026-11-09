"""Pure parking-rule evaluation engine (no database access).

Evaluates a planned stay [arrival, arrival + duration) against an area's rules in the area's local
timezone, splitting the stay into elementary segments at every rule boundary (DST-correct via zoneinfo).

Precedence inside a segment (highest first):
  closure > restriction (unless exempt) > permit_only / badge_only > paid > free > (nothing = UNKNOWN)
Max-stay rules accumulate time while their window is active and block the remainder once exceeded.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum
from zoneinfo import ZoneInfo

UTC = ZoneInfo("UTC")


class LegalStatus(StrEnum):
    PERMITTED = "permitted"  # legal for the whole stay
    PERMITTED_UNTIL = "permitted_until"  # legal at arrival, must leave before the stay ends
    NOT_PERMITTED = "not_permitted"  # not legal at arrival for this driver
    UNKNOWN = "unknown"  # no confirmed rule — check signs


class PricingStatus(StrEnum):
    FREE = "free"
    PAID = "paid"
    UNKNOWN = "unknown"
    NOT_APPLICABLE = "not_applicable"


class EligibilityStatus(StrEnum):
    ELIGIBLE = "eligible"
    PERMIT_REQUIRED = "permit_required"
    BADGE_REQUIRED = "badge_required"
    VEHICLE_NOT_ALLOWED = "vehicle_not_allowed"
    UNKNOWN = "unknown"


class Category(StrEnum):
    """Display classification (mirrors prototype legend). Rank order = free-first ranking."""

    FREE = "free"
    FREE_TIME_LIMITED = "free_time_limited"
    PAID = "paid"
    UNKNOWN = "unknown"
    RESTRICTED = "restricted"


CATEGORY_RANK = {
    Category.FREE: 0,
    Category.FREE_TIME_LIMITED: 1,
    Category.PAID: 2,
    Category.UNKNOWN: 3,
    Category.RESTRICTED: 4,
}


@dataclass(frozen=True)
class Window:
    days: frozenset[int]  # 0=Mon … 6=Sun
    start_minute: int
    end_minute: int  # <= start → crosses midnight; 1440 = end of day


@dataclass(frozen=True)
class RuleSpec:
    id: int
    kind: str  # free | paid | permit_only | badge_only | max_stay
    label: str
    windows: tuple[Window, ...] = ()
    rate_per_hour: Decimal | None = None
    billing_increment_minutes: int = 15
    minimum_charge: Decimal = Decimal("0")
    permit_code: str | None = None
    max_stay_minutes: int | None = None
    vehicle_classes: frozenset[str] = frozenset()
    valid_from: date | None = None
    valid_until: date | None = None


@dataclass(frozen=True)
class RestrictionSpec:
    id: int
    kind: str
    label: str
    windows: tuple[Window, ...] = ()
    exempt_permit_code: str | None = None
    vehicle_classes: frozenset[str] = frozenset()
    valid_from: date | None = None
    valid_until: date | None = None


@dataclass(frozen=True)
class ClosureSpec:
    id: int
    reason: str
    starts_at: datetime
    ends_at: datetime


@dataclass(frozen=True)
class AreaSpec:
    id: int
    timezone: str
    verification_status: str  # verified | community | unverified
    rules: tuple[RuleSpec, ...] = ()
    restrictions: tuple[RestrictionSpec, ...] = ()
    closures: tuple[ClosureSpec, ...] = ()


@dataclass(frozen=True)
class Driver:
    vehicle_class: str = "car"
    permits: frozenset[str] = frozenset()
    has_disabled_badge: bool = False


@dataclass
class Reason:
    code: str
    label: str
    at: datetime | None = None

    def as_dict(self):
        return {"code": self.code, "label": self.label, "at": self.at.isoformat() if self.at else None}


@dataclass
class Evaluation:
    area_id: int
    arrival_at: datetime
    departure_at: datetime
    legal_status: LegalStatus
    pricing_status: PricingStatus
    eligibility_status: EligibilityStatus
    category: Category
    expected_total_cost: Decimal | None
    paid_minutes: int
    leave_by: datetime | None = None
    leave_by_reason: Reason | None = None
    blocking_reason: Reason | None = None
    has_paid_periods: bool = False
    explanation_codes: list[str] = field(default_factory=list)

    @property
    def rank(self):
        return CATEGORY_RANK[self.category]


# ---------------------------------------------------------------- interval helpers


def _local_dt(d: date, minute: int, tz: ZoneInfo) -> datetime:
    if minute >= 1440:
        return datetime.combine(d + timedelta(days=1), time(0, 0), tzinfo=tz)
    return datetime.combine(d, time(minute // 60, minute % 60), tzinfo=tz)


def _valid_on(d: date, valid_from, valid_until) -> bool:
    return (valid_from is None or d >= valid_from) and (valid_until is None or d <= valid_until)


def active_intervals(windows, valid_from, valid_until, start: datetime, end: datetime, tz: ZoneInfo):
    """UTC intervals where a window-set is active, clipped to [start, end)."""
    s_local, e_local = start.astimezone(tz), end.astimezone(tz)
    out = []
    d = s_local.date() - timedelta(days=1)
    while d <= e_local.date():
        if _valid_on(d, valid_from, valid_until):
            if not windows:
                out.append((_local_dt(d, 0, tz), _local_dt(d, 1440, tz)))
            for w in windows:
                if d.weekday() not in w.days:
                    continue
                a = _local_dt(d, w.start_minute, tz)
                b = (
                    _local_dt(d, w.end_minute, tz)
                    if w.end_minute > w.start_minute
                    else _local_dt(d + timedelta(days=1), w.end_minute, tz)
                )
                out.append((a, b))
        d += timedelta(days=1)
    clipped = []
    for a, b in out:
        a_u, b_u = max(a.astimezone(UTC), start), min(b.astimezone(UTC), end)
        if a_u < b_u:
            clipped.append((a_u, b_u))
    clipped.sort()
    merged = []
    for a, b in clipped:
        if merged and a <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))
    return merged


def _covers(intervals, t):
    return any(a <= t < b for a, b in intervals)


def _applies_to_vehicle(spec, driver):
    return not spec.vehicle_classes or driver.vehicle_class in spec.vehicle_classes


def _money(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------- evaluation


def evaluate(area: AreaSpec, arrival_at: datetime, duration_minutes: int, driver: Driver | None = None) -> Evaluation:
    if arrival_at.tzinfo is None:
        raise ValueError("arrival_at must be timezone-aware")
    if duration_minutes <= 0:
        raise ValueError("duration_minutes must be positive")
    driver = driver or Driver()
    tz = ZoneInfo(area.timezone)
    start = arrival_at.astimezone(UTC)
    end = start + timedelta(minutes=duration_minutes)

    rules = [r for r in area.rules if _applies_to_vehicle(r, driver)]
    restrictions = [r for r in area.restrictions if _applies_to_vehicle(r, driver)]
    has_paid_any = any(r.kind == "paid" for r in rules)

    def iv(spec):
        return active_intervals(spec.windows, spec.valid_from, spec.valid_until, start, end, tz)

    closure_iv = [
        (c, [(max(c.starts_at, start), min(c.ends_at, end))])
        for c in area.closures
        if c.starts_at < end and c.ends_at > start
    ]
    restr_iv = [(r, iv(r)) for r in restrictions]
    rule_iv = [(r, iv(r)) for r in rules]

    # Elementary segment boundaries
    points = {start, end}
    for _, ivs in closure_iv + restr_iv + rule_iv:
        for a, b in ivs:
            points.update((a, b))
    bounds = sorted(p for p in points if start <= p <= end)
    segments = list(zip(bounds[:-1], bounds[1:], strict=False))

    unverified = area.verification_status == "unverified"
    states = []  # (a, b, state, reason, rule)
    for a, b in segments:
        state, reason, rule = _segment_state(a, closure_iv, restr_iv, rule_iv, driver)
        states.append([a, b, state, reason, rule])

    # Max-stay accumulation (only while a max_stay window is active, counted from arrival)
    for r, ivs in rule_iv:
        if r.kind != "max_stay" or not r.max_stay_minutes:
            continue
        used = 0.0
        for st in states:
            a, b = st[0], st[1]
            if st[2] not in ("free", "paid", "permit"):
                continue
            if not _covers(ivs, a):
                continue
            seg_min = (b - a).total_seconds() / 60
            if used + seg_min <= r.max_stay_minutes:
                used += seg_min
                continue
            cut = a + timedelta(minutes=r.max_stay_minutes - used)
            st[1] = cut
            idx = states.index(st)
            tail = [cut, b, "blocked", Reason("max_stay", r.label or f"Maximum stay {r.max_stay_minutes} min"), r]
            states.insert(idx + 1, tail)
            used = r.max_stay_minutes
            # everything after is blocked while the max-stay window remains active
            for later in states[idx + 2 :]:
                if _covers(ivs, later[0]) and later[2] in ("free", "paid", "permit"):
                    later[2], later[3] = "blocked", tail[3]
            break
    states = [s for s in states if s[1] > s[0]]

    ev = Evaluation(
        area_id=area.id,
        arrival_at=start,
        departure_at=end,
        legal_status=LegalStatus.UNKNOWN,
        pricing_status=PricingStatus.UNKNOWN,
        eligibility_status=EligibilityStatus.UNKNOWN,
        category=Category.UNKNOWN,
        expected_total_cost=None,
        paid_minutes=0,
        has_paid_periods=has_paid_any,
    )

    if unverified:
        ev.explanation_codes.append("rules_not_confirmed")
        return ev

    first = states[0]
    if first[2] == "blocked":
        reason = first[3]
        ev.legal_status = LegalStatus.NOT_PERMITTED
        ev.pricing_status = PricingStatus.NOT_APPLICABLE
        ev.category = Category.RESTRICTED
        ev.blocking_reason = Reason(reason.code, reason.label, first[0])
        ev.eligibility_status = {
            "permit_required": EligibilityStatus.PERMIT_REQUIRED,
            "badge_required": EligibilityStatus.BADGE_REQUIRED,
        }.get(reason.code, EligibilityStatus.ELIGIBLE)
        ev.explanation_codes.append(f"blocked_{reason.code}")
        return ev
    if first[2] == "unknown":
        ev.explanation_codes.append("no_permission_record")
        return ev

    # Legal at arrival: walk forward until the first non-permitted segment
    ev.eligibility_status = EligibilityStatus.ELIGIBLE
    cost = Decimal("0")
    paid_minutes = 0
    run_minutes, run_rule = 0.0, None

    def close_run():
        nonlocal cost, run_minutes, run_rule
        if run_rule is not None and run_minutes > 0:
            inc = max(1, run_rule.billing_increment_minutes)
            billable = math.ceil(round(run_minutes, 6) / inc) * inc
            c = (run_rule.rate_per_hour or Decimal("0")) * Decimal(billable) / Decimal(60)
            cost += max(c, run_rule.minimum_charge)
        run_minutes, run_rule = 0.0, None

    for a, b, state, reason, rule in states:
        if state in ("blocked", "unknown"):
            ev.leave_by = a
            code = reason.code if state == "blocked" else "rules_unconfirmed_after"
            label = reason.label if state == "blocked" else "No confirmed rule after this time"
            ev.leave_by_reason = Reason(code, label, a)
            break
        if state == "paid":
            mins = (b - a).total_seconds() / 60
            if run_rule is not None and run_rule.id != rule.id:
                close_run()
            run_rule = rule
            run_minutes += mins
            paid_minutes += round(mins)
        else:
            close_run()
    close_run()

    ev.paid_minutes = paid_minutes
    ev.expected_total_cost = _money(cost)
    ev.pricing_status = PricingStatus.PAID if cost > 0 else PricingStatus.FREE
    if ev.leave_by is not None:
        ev.legal_status = LegalStatus.PERMITTED_UNTIL
        ev.explanation_codes.append(f"leave_by_{ev.leave_by_reason.code}")
    else:
        ev.legal_status = LegalStatus.PERMITTED
    if cost > 0:
        ev.category = Category.PAID
        ev.explanation_codes.append("paid_hours_in_stay")
    elif ev.leave_by is not None:
        ev.category = Category.FREE_TIME_LIMITED
    elif has_paid_any:
        ev.category = Category.FREE_TIME_LIMITED
        ev.explanation_codes.append("free_outside_paid_hours")
    else:
        ev.category = Category.FREE
        ev.explanation_codes.append("free_whole_stay")
    if any(s[2] == "permit" for s in states):
        ev.explanation_codes.append("permit_used")
    return ev


def _segment_state(t, closure_iv, restr_iv, rule_iv, driver):
    for c, ivs in closure_iv:
        if _covers(ivs, t):
            return "blocked", Reason("temporary_closure", c.reason), None
    for r, ivs in restr_iv:
        if not _covers(ivs, t):
            continue
        if r.exempt_permit_code and r.exempt_permit_code in driver.permits:
            continue
        return "blocked", Reason(r.kind, r.label), None
    for r, ivs in rule_iv:
        if r.kind not in ("permit_only", "badge_only") or not _covers(ivs, t):
            continue
        if r.kind == "badge_only":
            if driver.has_disabled_badge or (r.permit_code and r.permit_code in driver.permits):
                return "permit", None, r
            return "blocked", Reason("badge_required", r.label), None
        if r.permit_code in driver.permits:
            return "permit", None, r
        return "blocked", Reason("permit_required", r.label), None
    paid = [(r, ivs) for r, ivs in rule_iv if r.kind == "paid" and _covers(ivs, t)]
    if paid:
        r = min(paid, key=lambda x: x[0].rate_per_hour or Decimal("0"))[0]
        return "paid", None, r
    if any(r.kind == "free" and _covers(ivs, t) for r, ivs in rule_iv):
        return "free", None, None
    return "unknown", None, None
