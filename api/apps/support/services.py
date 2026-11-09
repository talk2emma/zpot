import secrets

from apps.core.exceptions import ZpotAPIError
from apps.core.models import record_audit

from .models import GUIDANCE_CATEGORIES, SupportTicket


def create_ticket(*, user, category, description, contact_email="", include_context=False, context=None):
    authed = bool(user and user.is_authenticated)
    if not authed and not contact_email:
        raise ZpotAPIError(
            "Add an email so we can reply.",
            code="validation_error",
            details={"contact_email": ["Required when you are not signed in."]},
        )
    ref = None
    for _ in range(10):
        cand = f"ZS-{secrets.randbelow(900000) + 100000}"
        if not SupportTicket.objects.filter(reference=cand).exists():
            ref = cand
            break
    t = SupportTicket.objects.create(
        reference=ref,
        user=user if authed else None,
        contact_email=contact_email or (user.email if authed else ""),
        category=category,
        description=description.strip(),
        context=(context or {}) if include_context else {},
        priority="high" if category in GUIDANCE_CATEGORIES else "normal",
    )
    record_audit("support.ticket_created", actor=user if authed else None, target=t)
    return t
