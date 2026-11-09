import logging

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import ESSENTIAL, Category, Notification, NotificationPreference, PushStatus
from .templates_i18n import render

log = logging.getLogger("zpot.notifications")

PREF_FIELD = {
    Category.SESSION_REMINDER: "session_reminders",
    Category.RULE_CHANGE: "rule_changes",
    Category.REPORT_UPDATE: "report_updates",
    Category.SAVED_LOCATION: "saved_locations",
    Category.SERVICE: "service_news",
}


def prefs_for(user):
    obj, _ = NotificationPreference.objects.get_or_create(user=user)
    return obj


def _language(user):
    from apps.accounts.models import UserPreference

    return UserPreference.objects.filter(user=user).values_list("language", flat=True).first() or "en"


def notify(user, category, template, params, *, dedupe_key, target=None, force=False):
    """Create an inbox notification (idempotent on dedupe_key) and attempt push delivery.

    Returns the Notification, or None when the user opted out of a non-essential category.
    """
    prefs = prefs_for(user)
    field = PREF_FIELD.get(category)
    if not force and category not in ESSENTIAL and field and not getattr(prefs, field):
        return None
    title, body = render(template, params, _language(user))
    try:
        with transaction.atomic():
            n = Notification.objects.create(
                user=user,
                category=category,
                template=template,
                params=params,
                title=title[:160],
                body=body[:500],
                target=target or {},
                dedupe_key=dedupe_key[:120],
            )
    except IntegrityError:
        return Notification.objects.get(user=user, dedupe_key=dedupe_key[:120])
    deliver_push(n, prefs)
    return n


def deliver_push(n, prefs=None):
    """Push delivery. Without APNs/FCM credentials (PUSH_PROVIDER=none) we record that honestly."""
    prefs = prefs or prefs_for(n.user)
    n.push_attempted_at = timezone.now()
    if not prefs.push_enabled:
        n.push_status = PushStatus.SUPPRESSED
    elif not n.user.devices.filter(is_active=True).exists():
        n.push_status = PushStatus.NO_DEVICE
    elif settings.ZPOT["PUSH_PROVIDER"] == "none":
        n.push_status = PushStatus.NOT_CONFIGURED
    else:  # pragma: no cover - no provider wired in this build
        n.push_status = PushStatus.FAILED
        n.push_error = f"Unknown push provider {settings.ZPOT['PUSH_PROVIDER']!r}"
    n.save(update_fields=["push_status", "push_attempted_at", "push_error"])
    log.info("notification %s push_status=%s", n.id, n.push_status)
