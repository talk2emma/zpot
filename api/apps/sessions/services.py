"""Parking session lifecycle. All times are server (database) timestamps; the app never drives reminders."""

import math
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import ZpotAPIError
from apps.core.models import record_audit
from apps.notifications.models import Category
from apps.notifications.services import notify
from apps.parking.selectors import areas_with_regulations
from apps.regulations.services.engine import Driver, evaluate
from apps.regulations.services.specs import area_spec

from .models import ParkingReminder, ParkingSession, ParkingSessionEvent, ReminderKind, ReminderStatus, SessionStatus

MAX_STAY = timedelta(hours=24)


def _driver(session_or_kwargs):
    g = (
        session_or_kwargs.get
        if isinstance(session_or_kwargs, dict)
        else lambda k, d=None: getattr(session_or_kwargs, k, d)
    )
    permit = g("permit_type") or ""
    return Driver(
        vehicle_class=g("vehicle_class") or "car",
        permits=frozenset([permit]) if permit else frozenset(),
        has_disabled_badge=bool(g("has_disabled_badge")),
    )


def _evaluate(area, start, end, driver):
    minutes = max(1, math.ceil((end - start).total_seconds() / 60))
    ev = evaluate(area_spec(area), start, minutes, driver)
    snap = {
        "category": ev.category.value,
        "legal_status": ev.legal_status.value,
        "pricing_status": ev.pricing_status.value,
        "eligibility_status": ev.eligibility_status.value,
        "expected_total_cost": str(ev.expected_total_cost) if ev.expected_total_cost is not None else None,
        "leave_by": ev.leave_by.isoformat() if ev.leave_by else None,
        "leave_by_reason": ev.leave_by_reason.as_dict() if ev.leave_by_reason else None,
        "blocking_reason": ev.blocking_reason.as_dict() if ev.blocking_reason else None,
        "explanation_codes": ev.explanation_codes,
    }
    return ev, snap


def _deadline_horizon(area, start, driver):
    """Legal deadline within the next 24 h (independent of the user's plan)."""
    ev = evaluate(area_spec(area), start, 24 * 60, driver)
    return ev


def _apply_evaluation(session, area, now):
    driver = _driver(session)
    ev, snap = _evaluate(area, session.started_at, session.planned_end_at, driver)
    horizon = _deadline_horizon(area, session.started_at, driver)
    session.category = ev.category.value
    session.legal_status = ev.legal_status.value
    session.expected_cost = ev.expected_total_cost
    session.restriction_deadline = horizon.leave_by
    session.restriction_reason = horizon.leave_by_reason.label if horizon.leave_by_reason else ""
    session.evaluation = snap
    session.evaluated_at = now
    return ev


def _get_area(area_id):
    area = areas_with_regulations().filter(pk=area_id, is_active=True).first()
    if area is None:
        raise ZpotAPIError("Parking area not found.", code="not_found", status_code=404)
    return area


def _rebuild_reminders(session, now):
    session.reminders.filter(status=ReminderStatus.SCHEDULED).update(status=ReminderStatus.CANCELLED)
    wanted = []
    if session.reminder_minutes:
        wanted.append(
            (
                ReminderKind.PLANNED_DEPARTURE,
                session.reminder_minutes,
                session.planned_end_at - timedelta(minutes=session.reminder_minutes),
            )
        )
    if session.restriction_deadline and session.restriction_deadline > now:
        m = settings.ZPOT["RESTRICTION_WARNING_MINUTES"]
        wanted.append((ReminderKind.RESTRICTION_DEADLINE, m, session.restriction_deadline - timedelta(minutes=m)))
    for kind, minutes, fire_at in wanted:
        ParkingReminder.objects.create(session=session, kind=kind, minutes_before=minutes, fire_at=max(fire_at, now))


def _warnings(session):
    w = []
    if session.restriction_deadline and session.planned_end_at > session.restriction_deadline:
        w.append(
            {
                "code": "planned_end_after_deadline",
                "message": "Your plan runs past the time parking stops being allowed. Plan to move before then.",
                "deadline": session.restriction_deadline.isoformat(),
                "reason": session.restriction_reason,
            }
        )
    if session.category == "unknown":
        w.append({"code": "rules_unconfirmed", "message": "We have no confirmed rule here — check the signs."})
    if session.category == "paid":
        w.append(
            {
                "code": "paid_hours",
                "message": (
                    "Paid hours fall within your plan. Pay at the meter or the official app — "
                    "Zpot doesn't take payments."
                ),
            }
        )
    return w


@transaction.atomic
def start_session(
    user,
    *,
    area_id,
    planned_end_at=None,
    duration_minutes=None,
    reminder_minutes=15,
    vehicle_class="car",
    permit_type="",
    has_disabled_badge=False,
):
    now = timezone.now()
    if ParkingSession.objects.select_for_update().filter(user=user, status=SessionStatus.ACTIVE).exists():
        raise ZpotAPIError(
            "You already have an active parking session. End it before starting another.",
            code="active_session_exists",
            status_code=409,
        )
    if planned_end_at is None:
        planned_end_at = now + timedelta(minutes=duration_minutes or 120)
    if planned_end_at <= now:
        raise ZpotAPIError("Planned departure must be in the future.", code="invalid_planned_end", status_code=400)
    if planned_end_at - now > MAX_STAY:
        raise ZpotAPIError("Sessions can be planned for up to 24 hours.", code="invalid_planned_end", status_code=400)
    area = _get_area(area_id)
    session = ParkingSession(
        user=user,
        area=area,
        started_at=now,
        planned_end_at=planned_end_at,
        reminder_minutes=reminder_minutes,
        vehicle_class=vehicle_class,
        permit_type=permit_type or "",
        has_disabled_badge=has_disabled_badge,
    )
    ev = _apply_evaluation(session, area, now)
    if ev.category.value == "restricted":
        raise ZpotAPIError(
            ev.blocking_reason.label if ev.blocking_reason else "Parking is not permitted here now.",
            code="parking_not_permitted",
            status_code=409,
            details={"blocking_reason": session.evaluation.get("blocking_reason")},
        )
    session.save()
    ParkingSessionEvent.objects.create(
        session=session,
        kind="started",
        data={"planned_end_at": planned_end_at.isoformat(), "evaluation": session.evaluation},
    )
    _rebuild_reminders(session, now)
    record_audit("session.started", actor=user, target=session)
    return session, _warnings(session)


def _owned(user, session_id, lock=False):
    qs = ParkingSession.objects.select_related("area", "area__city")
    if lock:
        qs = qs.select_for_update()
    s = qs.filter(pk=session_id, user=user).first()
    if s is None:  # 404 (not 403) so other users' session ids are not disclosed
        raise ZpotAPIError("Session not found.", code="not_found", status_code=404)
    return s


@transaction.atomic
def update_session(user, session_id, *, planned_end_at=None, reminder_minutes=None):
    now = timezone.now()
    s = _owned(user, session_id, lock=True)
    if s.status != SessionStatus.ACTIVE:
        raise ZpotAPIError("This session has ended and can't be edited.", code="session_not_active", status_code=409)
    before = {
        "planned_end_at": s.planned_end_at.isoformat(),
        "category": s.category,
        "deadline": s.restriction_deadline.isoformat() if s.restriction_deadline else None,
    }
    if planned_end_at is not None:
        if planned_end_at <= now:
            raise ZpotAPIError("Planned departure must be in the future.", code="invalid_planned_end", status_code=400)
        if planned_end_at - s.started_at > MAX_STAY:
            raise ZpotAPIError(
                "Sessions can be planned for up to 24 hours.", code="invalid_planned_end", status_code=400
            )
        s.planned_end_at = planned_end_at
    if reminder_minutes is not None:
        s.reminder_minutes = reminder_minutes
    area = _get_area(s.area_id)
    _apply_evaluation(s, area, now)  # rules re-evaluated for the new plan
    s.save()
    ParkingSessionEvent.objects.create(
        session=s,
        kind="edited",
        data={
            "before": before,
            "after": {
                "planned_end_at": s.planned_end_at.isoformat(),
                "category": s.category,
                "deadline": s.restriction_deadline.isoformat() if s.restriction_deadline else None,
            },
        },
    )
    _rebuild_reminders(s, now)
    return s, _warnings(s)


@transaction.atomic
def end_session(user, session_id, *, cost_paid=None, outcome="", share_departure=False, client_token=""):
    """Idempotent: ending an already-ended session returns it unchanged (already_ended=True)."""
    now = timezone.now()
    s = _owned(user, session_id, lock=True)
    if s.status in (SessionStatus.ENDED, SessionStatus.EXPIRED, SessionStatus.CANCELLED):
        return s, True
    s.status = SessionStatus.ENDED
    s.ended_at = max(now, s.started_at)
    s.cost_paid = cost_paid
    s.outcome = outcome or ""
    s.shared_departure = bool(share_departure)
    s.save()
    s.reminders.filter(status=ReminderStatus.SCHEDULED).update(status=ReminderStatus.CANCELLED)
    ParkingSessionEvent.objects.create(
        session=s,
        kind="ended",
        data={"cost_paid": str(cost_paid) if cost_paid is not None else None, "share_departure": bool(share_departure)},
    )
    if share_departure:
        from apps.reports.services import create_report

        create_report(
            user=user,
            client_token=client_token,
            type="leaving",
            area_id=s.area_id,
            latitude=s.area.location.y,
            longitude=s.area.location.x,
            details={"confirm": True, "from_session": str(s.id)},
            device_latitude=s.area.location.y,
            device_longitude=s.area.location.x,
        )
    record_audit("session.ended", actor=user, target=s)
    return s, False


def expire_stale(now=None):
    """Sessions left active long after their plan are closed as EXPIRED (not 'ended')."""
    now = now or timezone.now()
    cutoff = now - timedelta(hours=settings.ZPOT["SESSION_EXPIRE_AFTER_HOURS"])
    n = 0
    for s in ParkingSession.objects.filter(status=SessionStatus.ACTIVE, planned_end_at__lt=cutoff):
        s.status = SessionStatus.EXPIRED
        s.ended_at = s.planned_end_at
        s.save(update_fields=["status", "ended_at", "updated_at"])
        s.reminders.filter(status=ReminderStatus.SCHEDULED).update(status=ReminderStatus.CANCELLED)
        ParkingSessionEvent.objects.create(session=s, kind="expired", data={})
        n += 1
    return n


def _fmt_minutes(m):
    m = max(0, int(round(m)))
    return f"{m // 60} h {m % 60} min" if m >= 60 else f"{m} min"


def dispatch_due(now=None, limit=200):
    """Send due reminders exactly once. Safe to run concurrently (SKIP LOCKED) and repeatedly."""
    now = now or timezone.now()
    sent = 0
    with transaction.atomic():
        due = list(
            ParkingReminder.objects.select_for_update(skip_locked=True)
            .select_related("session", "session__area", "session__user")
            .filter(status=ReminderStatus.SCHEDULED, fire_at__lte=now)[:limit]
        )
        for r in due:
            s = r.session
            r.attempts += 1
            if s.status != SessionStatus.ACTIVE:
                r.status = ReminderStatus.CANCELLED
                r.save(update_fields=["status", "attempts"])
                continue
            try:
                tz = s.area.city.timezone
                from zoneinfo import ZoneInfo

                if r.kind == ReminderKind.RESTRICTION_DEADLINE:
                    t = s.restriction_deadline.astimezone(ZoneInfo(tz)).strftime("%H:%M")
                    n = notify(
                        s.user,
                        Category.RESTRICTION,
                        "restriction_deadline",
                        {"time": t, "place": s.area.name, "reason": s.restriction_reason or "restriction"},
                        dedupe_key=f"reminder:{r.id}",
                        target={"route": "Session", "id": str(s.id)},
                    )
                else:
                    t = s.planned_end_at.astimezone(ZoneInfo(tz)).strftime("%H:%M")
                    n = notify(
                        s.user,
                        Category.SESSION_REMINDER,
                        "session_reminder",
                        {
                            "left": _fmt_minutes((s.planned_end_at - now).total_seconds() / 60),
                            "place": s.area.name,
                            "time": t,
                        },
                        dedupe_key=f"reminder:{r.id}",
                        target={"route": "Session", "id": str(s.id)},
                    )
                r.status, r.sent_at, r.notification = ReminderStatus.SENT, now, n
                ParkingSessionEvent.objects.create(
                    session=s, kind="reminder_sent", data={"reminder": r.id, "kind": r.kind}
                )
                sent += 1
            except Exception as exc:  # noqa: BLE001 - record and retry on next tick
                r.last_error = str(exc)[:240]
                if r.attempts >= 5:
                    r.status = ReminderStatus.FAILED
            r.save()
    return sent


def summary(session):
    from apps.parking.models import ParkingArea

    end = session.ended_at or timezone.now()
    minutes = max(0, int((end - session.started_at).total_seconds() // 60))
    hours = max(1, math.ceil(minutes / 60))
    saving = None
    if session.cost_paid is not None:
        alt = (
            ParkingArea.objects.filter(
                supported_area=session.area.supported_area, rules__kind="paid", rules__tariff__isnull=False
            )
            .exclude(pk=session.area_id)
            .order_by("rules__tariff__rate_per_hour")
            .values_list("name", "rules__tariff__rate_per_hour")
            .first()
        )
        if alt:
            alt_cost = Decimal(alt[1]) * hours
            if alt_cost > session.cost_paid:
                saving = {
                    "amount": str((alt_cost - session.cost_paid).quantize(Decimal("0.01"))),
                    "compared_with": alt[0],
                    "rate_per_hour": str(alt[1]),
                    "hours": hours,
                    "note": "An estimate, not a guarantee.",
                }
    return {
        "session_id": str(session.id),
        "area": {"id": session.area_id, "name": session.area.name},
        "status": session.status,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "duration_minutes": minutes,
        "verification_status": session.area.verification_status,
        "expected_cost": session.expected_cost,
        "cost_paid": session.cost_paid,
        "estimated_saving": saving,
        "shared_departure": session.shared_departure,
        "outcome": session.outcome,
    }
