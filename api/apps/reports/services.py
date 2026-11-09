"""Community reporting: validation, duplicate detection, trust policy, moderation, appeals, verification."""

import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.availability.models import ObservationKind, ParkingObservation
from apps.availability.services import extend_on_confirm, haversine_m, state_of, trust_score, ttl_minutes
from apps.cities.selectors import city_for_point
from apps.community.models import ContributorTrustEvent, ReportVerification, VerificationAnswer
from apps.core.exceptions import ZpotAPIError
from apps.core.models import record_audit
from apps.notifications.models import Category
from apps.notifications.services import notify
from apps.parking.models import ParkingArea

from .models import (
    EPHEMERAL_TYPES,
    GUEST_ALLOWED_TYPES,
    AppealStatus,
    CommunityReport,
    ModerationDecision,
    ReportAppeal,
    ReportModeration,
    ReportStatus,
    ReportType,
)

OBS_KIND = {
    ReportType.LEAVING: ObservationKind.LEAVING,
    ReportType.FOUND: ObservationKind.AVAILABLE,
    ReportType.OCCUPIED: ObservationKind.OCCUPIED,
}
TRUST_DELTA = {
    "accepted": 0.05,
    "rejected": -0.1,
    "appeal_upheld": 0.05,
    "confirmed_by_others": 0.02,
    "contradicted_by_others": -0.02,
}

STATUS_LABEL = {
    "accepted": "accepted",
    "rejected": "not accepted",
    "under_review": "in review",
    "appeal_review": "appeal in review",
    "duplicate": "duplicate",
}


def _reference():
    for _ in range(10):
        ref = f"ZR-{secrets.randbelow(900000) + 100000}"
        if not CommunityReport.objects.filter(reference=ref).exists():
            return ref
    raise RuntimeError("could not allocate report reference")


def _validate_details(type_, details, description):
    errors = {}
    if type_ == ReportType.LEAVING and details.get("confirm") is not True:
        errors["details.confirm"] = ["Confirm that you are leaving now."]
    if type_ == ReportType.INCORRECT_RULE and not details.get("issue"):
        errors["details.issue"] = ["Choose what is wrong."]
    if type_ == ReportType.CLOSURE and details.get("until") not in ("today", "few_days", "not_sure"):
        errors["details.until"] = ["Say how long the closure lasts."]
    if (
        type_
        in (
            ReportType.INCORRECT_RULE,
            ReportType.NEW_SIGN,
            ReportType.OTHER,
            ReportType.WRONG_LOCATION,
            ReportType.OBSTRUCTION,
        )
        and len((description or "").strip()) < 10
    ):
        errors["description"] = ["Describe what you saw (at least 10 characters)."]
    if errors:
        raise ZpotAPIError("Some fields are invalid.", code="validation_error", details=errors)


def _trust(user, client_token):
    return user if (user and user.is_authenticated) else None


@transaction.atomic
def create_report(
    *,
    user,
    client_token,
    type,
    latitude,
    longitude,
    area_id=None,
    scope="spot",
    details=None,
    description="",
    device_latitude=None,
    device_longitude=None,
):
    now = timezone.now()
    details = details or {}
    authed = bool(user and user.is_authenticated)
    if not authed and type not in GUEST_ALLOWED_TYPES:
        raise ZpotAPIError(
            "Sign in to report rule problems so we can follow up with you.", code="not_authenticated", status_code=401
        )
    if not authed and not client_token:
        raise ZpotAPIError("Missing client token.", code="client_token_required", status_code=400)
    point = Point(longitude, latitude, srid=4326)
    city = city_for_point(latitude, longitude)
    if city is None or not city.is_supported:
        raise ZpotAPIError(
            "Reports can only be made inside a supported city.", code="location_unsupported", status_code=400
        )
    area = None
    if area_id is not None:
        area = ParkingArea.objects.filter(pk=area_id, is_active=True).first()
        if area is None:
            raise ZpotAPIError("Parking area not found.", code="not_found", status_code=404)
        if haversine_m(area.location.y, area.location.x, latitude, longitude) > 200:
            raise ZpotAPIError("The report location is too far from that parking area.", code="location_mismatch")
    _validate_details(type, details, description)

    # Duplicate detection: same reporter, same type, nearby, recent
    window = now - timedelta(minutes=settings.ZPOT["DUPLICATE_REPORT_WINDOW_MIN"])
    who = {"reporter": user} if authed else {"client_token": client_token}
    dup = (
        CommunityReport.objects.filter(type=type, created_at__gte=window, **who)
        .filter(location__dwithin=(point, D(m=settings.ZPOT["DUPLICATE_REPORT_RADIUS_M"])))
        .first()
    )
    if dup:
        raise ZpotAPIError(
            "You already reported this a moment ago.",
            code="duplicate_report",
            status_code=409,
            details={"existing_reference": dup.reference},
        )

    device = (
        Point(device_longitude, device_latitude, srid=4326)
        if device_latitude is not None and device_longitude is not None
        else None
    )
    score, explain = trust_score(
        user=_trust(user, client_token), report_point=point, device_point=device, observed_at=now, now=now
    )
    r = CommunityReport(
        reference=_reference(),
        reporter=user if authed else None,
        client_token=client_token or "",
        type=type,
        area=area,
        location=point,
        scope=scope,
        details=details,
        description=(description or "").strip(),
        trust_score=score,
        trust_explanation=explain,
    )
    if type in EPHEMERAL_TYPES:
        if score >= settings.ZPOT["TRUST_PUBLISH_THRESHOLD"]:
            r.status = ReportStatus.PUBLISHED
            r.observation = _apply_observation(type, area, point, user if authed else None, score, now)
        else:
            r.status = ReportStatus.PENDING_REVIEW  # low trust: not shown to drivers until confirmed/reviewed
    else:
        r.status = ReportStatus.PENDING_REVIEW  # rule corrections never change canonical data directly
    r.save()
    record_audit("report.created", actor=user if authed else None, target=r, type=type, status=r.status)
    return r


def _apply_observation(type_, area, point, reporter, score, now):
    kind = OBS_KIND[type_]
    if kind == ObservationKind.OCCUPIED:
        # An "occupied" report contradicts live availability signals at the same place
        live = ParkingObservation.objects.filter(
            expires_at__gt=now, kind__in=[ObservationKind.AVAILABLE, ObservationKind.LEAVING]
        )
        live = live.filter(area=area) if area else live.filter(location__dwithin=(point, D(m=30)))
        for o in live.select_for_update():
            o.contradictions += 1
            o.needs_review = o.contradictions > 0
            o.save(update_fields=["contradictions", "needs_review"])
    return ParkingObservation.objects.create(
        area=area,
        reporter=reporter,
        kind=kind,
        location=point,
        observed_at=now,
        expires_at=now + timedelta(minutes=ttl_minutes(kind)),
        trust_score=score,
    )


def visible_to(report, user, client_token, reviewer=False):
    if reviewer:
        return True
    if user and user.is_authenticated and report.reporter_id == user.id:
        return True
    return bool(client_token) and report.client_token == client_token


@transaction.atomic
def verify_observation(*, observation_id, answer, user, client_token):
    now = timezone.now()
    obs = ParkingObservation.objects.select_for_update().filter(pk=observation_id).first()
    if obs is None:
        raise ZpotAPIError("Observation not found.", code="not_found", status_code=404)
    st = state_of(obs, now)
    if st.value == "observation_expired":
        raise ZpotAPIError("This report has expired.", code="observation_expired", status_code=410)
    authed = bool(user and user.is_authenticated)
    if authed and obs.reporter_id == user.id:
        raise ZpotAPIError("You can't verify your own report.", code="own_observation", status_code=403)
    if not authed and not client_token:
        raise ZpotAPIError("Missing client token.", code="client_token_required", status_code=400)
    try:
        with transaction.atomic():
            ReportVerification.objects.create(
                observation=obs,
                voter=user if authed else None,
                client_token="" if authed else client_token,
                answer=answer,
            )
    except IntegrityError as exc:
        raise ZpotAPIError("You already answered for this spot.", code="already_verified", status_code=409) from exc
    if answer == VerificationAnswer.STILL_AVAILABLE and obs.kind != ObservationKind.OCCUPIED:
        obs.confirmations += 1
        extend_on_confirm(obs, now)
        delta_reason = "confirmed_by_others"
    elif answer == VerificationAnswer.TAKEN:
        obs.contradictions += 1
        obs.needs_review = True
        delta_reason = "contradicted_by_others"
    else:
        delta_reason = None
    obs.save()
    if delta_reason and obs.reporter_id:
        ContributorTrustEvent.objects.create(
            user_id=obs.reporter_id,
            delta=TRUST_DELTA[delta_reason],
            reason=delta_reason,
            report=getattr(obs, "report", None),
        )
    new_state = state_of(obs, now)
    rep = getattr(obs, "report", None)
    if rep and new_state.value == "observation_expired" and rep.status == ReportStatus.PUBLISHED:
        rep.status = ReportStatus.SUPERSEDED
        rep.save(update_fields=["status", "updated_at"])
    return obs, new_state


TRANSITIONS = {
    ModerationDecision.START_REVIEW: ({ReportStatus.PENDING_REVIEW}, ReportStatus.UNDER_REVIEW),
    ModerationDecision.ACCEPT: (
        {ReportStatus.PENDING_REVIEW, ReportStatus.UNDER_REVIEW, ReportStatus.APPEAL_REVIEW},
        ReportStatus.ACCEPTED,
    ),
    ModerationDecision.REJECT: (
        {ReportStatus.PENDING_REVIEW, ReportStatus.UNDER_REVIEW, ReportStatus.APPEAL_REVIEW},
        ReportStatus.REJECTED,
    ),
    ModerationDecision.DUPLICATE: ({ReportStatus.PENDING_REVIEW, ReportStatus.UNDER_REVIEW}, ReportStatus.DUPLICATE),
    ModerationDecision.ESCALATE_TO_SCOUT: (
        {ReportStatus.PENDING_REVIEW, ReportStatus.UNDER_REVIEW},
        ReportStatus.UNDER_REVIEW,
    ),
}


@transaction.atomic
def moderate(report, *, moderator, decision, reason=""):
    allowed, to = TRANSITIONS[decision]
    if report.status not in allowed:
        raise ZpotAPIError(
            f"Can't {decision} a report that is {report.status}.", code="invalid_transition", status_code=409
        )
    if decision == ModerationDecision.REJECT and not reason.strip():
        raise ZpotAPIError("Give a reason for the rejection (shown to the reporter).", code="reason_required")
    frm = report.status
    was_appeal = frm == ReportStatus.APPEAL_REVIEW
    report.status = to
    if decision == ModerationDecision.REJECT:
        report.rejection_reason = reason.strip()
    report.save()
    ReportModeration.objects.create(
        report=report, moderator=moderator, decision=decision, reason=reason, from_status=frm, to_status=to
    )
    if decision == ModerationDecision.ESCALATE_TO_SCOUT and report.area_id:
        from apps.scouts.models import ScoutAssignment

        ScoutAssignment.objects.get_or_create(
            report=report,
            defaults={
                "area_id": report.area_id,
                "created_by": moderator,
                "reason": f"Verify {report.get_type_display()}",
            },
        )
    if report.reporter_id:
        if decision in (ModerationDecision.ACCEPT, ModerationDecision.REJECT):
            key = (
                "appeal_upheld"
                if (was_appeal and decision == ModerationDecision.ACCEPT)
                else ("accepted" if decision == ModerationDecision.ACCEPT else "rejected")
            )
            ContributorTrustEvent.objects.create(
                user_id=report.reporter_id, delta=TRUST_DELTA[key], reason=key, report=report
            )
            if was_appeal and hasattr(report, "appeal"):
                a = report.appeal
                a.status = AppealStatus.UPHELD if decision == ModerationDecision.ACCEPT else AppealStatus.DISMISSED
                a.resolved_by, a.resolved_at = moderator, timezone.now()
                a.save()
        notify(
            report.reporter,
            Category.REPORT_UPDATE,
            "report_status",
            {
                "ref": report.reference,
                "status": STATUS_LABEL.get(to, to),
                "detail": reason or "Thanks — the data team has reviewed your report.",
            },
            dedupe_key=f"report:{report.id}:{to}:{ReportModeration.objects.filter(report=report).count()}",
            target={"route": "ReportDetail", "id": str(report.id)},
        )
    record_audit("report.moderated", actor=moderator, target=report, decision=decision, to=to)
    return report


@transaction.atomic
def appeal(report, *, user, message):
    if report.reporter_id != getattr(user, "id", None):
        raise ZpotAPIError("Report not found.", code="not_found", status_code=404)
    if report.status != ReportStatus.REJECTED:
        raise ZpotAPIError("Only rejected reports can be appealed.", code="not_appealable", status_code=409)
    if hasattr(report, "appeal"):
        raise ZpotAPIError("You already appealed this decision.", code="already_appealed", status_code=409)
    if len(message.strip()) < 10:
        raise ZpotAPIError(
            "Explain why (at least 10 characters).",
            code="validation_error",
            details={"message": ["At least 10 characters."]},
        )
    a = ReportAppeal.objects.create(report=report, user=user, message=message.strip())
    report.status = ReportStatus.APPEAL_REVIEW
    report.save(update_fields=["status", "updated_at"])
    record_audit("report.appealed", actor=user, target=report)
    return a
