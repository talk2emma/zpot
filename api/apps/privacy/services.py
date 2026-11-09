"""GDPR-oriented user data controls. This is engineering support for access/erasure requests — legal review of
retention periods, lawful bases and processors is still required (see docs/security/privacy.md)."""

import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import ConsentRecord, ConsentType
from apps.core.exceptions import ZpotAPIError
from apps.core.models import record_audit

from .models import DataPrivacyRequest, RequestKind, RequestStatus

CONSENT_TO_PREF = {ConsentType.ANALYTICS: "analytics_opt_in", ConsentType.PERSONALISED_ADS: "personalised_ads"}


def current_consents(user):
    out = {}
    for ct in ConsentType:
        rec = ConsentRecord.objects.filter(user=user, consent_type=ct).order_by("-recorded_at").first()
        out[ct.value] = {
            "granted": rec.granted if rec else False,
            "recorded_at": rec.recorded_at if rec else None,
            "document_version": rec.document_version if rec else None,
        }
    return out


@transaction.atomic
def update_consents(user, changes):
    from apps.accounts.models import UserPreference

    prefs, _ = UserPreference.objects.get_or_create(user=user)
    for key, granted in changes.items():
        if key in (ConsentType.TERMS, ConsentType.PRIVACY) and not granted:
            raise ZpotAPIError(
                "Withdrawing consent to the terms means deleting your account (Privacy › Delete).",
                code="use_deletion_request",
                status_code=400,
            )
        ConsentRecord.objects.create(user=user, consent_type=key, granted=granted, source="privacy_settings")
        if key in CONSENT_TO_PREF:
            setattr(prefs, CONSENT_TO_PREF[key], granted)
    prefs.save()
    record_audit("privacy.consents_updated", actor=user, target=user, changes=changes)
    return current_consents(user)


def _reference():
    return f"ZD-{secrets.randbelow(900000) + 100000}"


def request_export(user):
    if DataPrivacyRequest.objects.filter(
        user=user, kind=RequestKind.EXPORT, status__in=[RequestStatus.RECEIVED, RequestStatus.PROCESSING]
    ).exists():
        raise ZpotAPIError("An export is already being prepared.", code="request_in_progress", status_code=409)
    r = DataPrivacyRequest.objects.create(
        reference=_reference(), user=user, user_email=user.email, kind=RequestKind.EXPORT
    )
    record_audit("privacy.export_requested", actor=user, target=r)
    from .tasks import process_privacy_request

    transaction.on_commit(lambda: process_privacy_request.delay(str(r.id)))
    return r


def build_export(user):
    from apps.notifications.models import Notification
    from apps.reports.models import CommunityReport
    from apps.saved.models import SavedDestination, SavedParkingLocation, SearchHistory
    from apps.sessions.models import ParkingSession
    from apps.support.models import SupportTicket

    def dt(v):
        return v.isoformat() if v else None

    p = getattr(user, "preferences", None)
    return {
        "generated_at": timezone.now().isoformat(),
        "account": {
            "email": user.email,
            "display_name": getattr(getattr(user, "profile", None), "display_name", ""),
            "date_joined": dt(user.date_joined),
            "email_verified": user.is_email_verified,
            "roles": list(user.roles.values_list("role", flat=True)),
        },
        "preferences": {f.name: str(getattr(p, f.name)) for f in p._meta.fields if f.name not in ("id", "user")}
        if p
        else {},
        "consents": [
            {
                "type": c.consent_type,
                "granted": c.granted,
                "version": c.document_version,
                "recorded_at": dt(c.recorded_at),
            }
            for c in user.consents.all()
        ],
        "parking_sessions": [
            {
                "area": s.area.name,
                "status": s.status,
                "started_at": dt(s.started_at),
                "planned_end_at": dt(s.planned_end_at),
                "ended_at": dt(s.ended_at),
                "cost_paid": str(s.cost_paid) if s.cost_paid is not None else None,
            }
            for s in ParkingSession.objects.filter(user=user).select_related("area")
        ],
        "reports": [
            {
                "reference": r.reference,
                "type": r.type,
                "status": r.status,
                "created_at": dt(r.created_at),
                "latitude": r.location.y,
                "longitude": r.location.x,
                "description": r.description,
            }
            for r in CommunityReport.objects.filter(reporter=user)
        ],
        "saved_locations": [
            {"label": s.label, "area": s.area.name}
            for s in SavedParkingLocation.objects.filter(user=user).select_related("area")
        ],
        "saved_destinations": [{"label": d.label, "name": d.name} for d in SavedDestination.objects.filter(user=user)],
        "search_history": [
            {"name": h.name, "searched_at": dt(h.searched_at)} for h in SearchHistory.objects.filter(user=user)
        ],
        "notifications": [
            {"title": n.title, "created_at": dt(n.created_at)} for n in Notification.objects.filter(user=user)
        ],
        "support_tickets": [
            {"reference": t.reference, "category": t.category, "status": t.status}
            for t in SupportTicket.objects.filter(user=user)
        ],
        "note": "Device location is not stored continuously by Zpot; only locations you submitted are included.",
    }


def process(request_id):
    r = DataPrivacyRequest.objects.select_related("user").filter(pk=request_id).first()
    if r is None or r.status not in (RequestStatus.RECEIVED, RequestStatus.FAILED):
        return None
    r.status = RequestStatus.PROCESSING
    r.save(update_fields=["status"])
    try:
        if r.kind == RequestKind.EXPORT:
            data = json.dumps(build_export(r.user), indent=2, ensure_ascii=False).encode()
            r.file.save(f"{r.reference}.json", ContentFile(data), save=False)
            r.expires_at = timezone.now() + timedelta(days=settings.ZPOT["PRIVACY_EXPORT_TTL_DAYS"])
            from apps.notifications.models import Category
            from apps.notifications.services import notify

            notify(
                r.user,
                Category.PRIVACY,
                "privacy_export_ready",
                {"days": settings.ZPOT["PRIVACY_EXPORT_TTL_DAYS"]},
                dedupe_key=f"privacy:{r.id}",
                target={"route": "PrivacyRequests"},
            )
        r.status, r.completed_at = RequestStatus.COMPLETED, timezone.now()
    except Exception as exc:  # noqa: BLE001
        r.status, r.error = RequestStatus.FAILED, str(exc)[:240]
    r.save()
    return r


@transaction.atomic
def request_deletion(user, confirm):
    """Immediate erasure (no grace period in this build). Reports are anonymised, not deleted, because they are
    part of the community data record; everything personal cascades."""
    if (confirm or "").strip().upper() != "DELETE":
        raise ZpotAPIError("Type DELETE to confirm.", code="validation_error", details={"confirm": ["Type DELETE."]})
    r = DataPrivacyRequest.objects.create(
        reference=_reference(),
        user=user,
        user_email=user.email,
        kind=RequestKind.DELETION,
        status=RequestStatus.PROCESSING,
    )
    from apps.accounts.services import delete_account
    from apps.reports.models import CommunityReport

    CommunityReport.objects.filter(reporter=user).update(reporter=None, description="")
    delete_account(user)
    r.user = None  # the account row no longer exists; the email keeps the request auditable
    r.status, r.completed_at = RequestStatus.COMPLETED, timezone.now()
    r.save()
    return r


def retention_cleanup(now=None):
    from apps.saved.models import SearchHistory
    from apps.sessions.models import ParkingSession

    now = now or timezone.now()
    z = settings.ZPOT
    out = {}
    exp = DataPrivacyRequest.objects.filter(kind=RequestKind.EXPORT, status=RequestStatus.COMPLETED, expires_at__lt=now)
    for r in exp:
        if r.file:
            r.file.delete(save=False)
        r.status = RequestStatus.EXPIRED
        r.save(update_fields=["file", "status"])
    out["exports_expired"] = len(exp)
    out["search_history"] = SearchHistory.objects.filter(
        searched_at__lt=now - timedelta(days=z["SEARCH_HISTORY_RETENTION_DAYS"])
    ).delete()[0]
    out["sessions"] = ParkingSession.objects.filter(
        ended_at__lt=now - timedelta(days=z["SESSION_RETENTION_DAYS"])
    ).delete()[0]
    return out
