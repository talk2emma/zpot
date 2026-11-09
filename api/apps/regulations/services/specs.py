"""Adapters from ORM objects (with prefetched relations) to engine specs."""

from apps.regulations.services.engine import AreaSpec, ClosureSpec, RestrictionSpec, RuleSpec, Window


def _windows(obj):
    return tuple(Window(frozenset(w.days), w.start_minute, w.end_minute) for w in obj.windows.all())


def rule_spec(r):
    t = r.tariff
    return RuleSpec(
        id=r.id,
        kind=r.kind,
        label=r.label,
        windows=_windows(r),
        rate_per_hour=t.rate_per_hour if t else None,
        billing_increment_minutes=t.billing_increment_minutes if t else 15,
        minimum_charge=t.minimum_charge if t else 0,
        permit_code=r.permit_type.code if r.permit_type_id else None,
        max_stay_minutes=r.max_stay_minutes,
        vehicle_classes=frozenset(r.vehicle_classes or ()),
        valid_from=r.valid_from,
        valid_until=r.valid_until,
    )


def restriction_spec(r):
    return RestrictionSpec(
        id=r.id,
        kind=r.kind,
        label=r.label,
        windows=_windows(r),
        exempt_permit_code=r.exempt_permit_type.code if r.exempt_permit_type_id else None,
        vehicle_classes=frozenset(r.vehicle_classes or ()),
        valid_from=r.valid_from,
        valid_until=r.valid_until,
    )


def area_spec(area):
    return AreaSpec(
        id=area.id,
        timezone=area.city.timezone,
        verification_status=area.verification_status,
        rules=tuple(rule_spec(r) for r in area.rules.all()),
        restrictions=tuple(restriction_spec(r) for r in area.restrictions.all()),
        closures=tuple(ClosureSpec(c.id, c.reason, c.starts_at, c.ends_at) for c in area.closures.all()),
    )


REGULATION_PREFETCH = (
    "rules__windows",
    "rules__tariff",
    "rules__permit_type",
    "rules__source",
    "restrictions__windows",
    "restrictions__exempt_permit_type",
    "restrictions__source",
    "closures",
)
