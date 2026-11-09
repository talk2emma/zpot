"""Account business logic. Views stay thin; everything stateful lives here."""

from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import record_audit

from .models import ConsentRecord, ConsentType, Role, UserPreference, UserProfile, UserRole
from .tasks import send_email_task
from .tokens import (
    TokenError,
    make_email_verification_token,
    make_password_reset_token,
    read_email_verification_token,
    read_password_reset_token,
)

User = get_user_model()


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _links(path, token):
    t = quote(token, safe="")
    return f"{settings.APP_LINK_BASE}{path}?token={t}", f"{settings.WEB_LINK_BASE}/{path}/?token={t}"


def send_verification_email(user):
    app_link, web_link = _links("verify-email", make_email_verification_token(user))
    body = (
        "Welcome to Zpot.\n\nConfirm your email address by opening this link on your phone:\n"
        f"{app_link}\n\nIf the link doesn't open the app, use:\n{web_link}\n\n"
        "The link expires in 48 hours. If you didn't create a Zpot account, ignore this email."
    )
    send_email_task.delay("Confirm your Zpot email", body, user.email)


@transaction.atomic
def register_user(*, email, password, display_name="", language="en", accepted_terms=True, request=None):
    user = User.objects.create_user(email=email, password=password)
    UserProfile.objects.create(user=user, display_name=display_name)
    UserPreference.objects.create(user=user, language=language)
    UserRole.objects.create(user=user, role=Role.DRIVER)
    ConsentRecord.objects.bulk_create(
        [
            ConsentRecord(user=user, consent_type=ConsentType.TERMS, granted=accepted_terms),
            ConsentRecord(user=user, consent_type=ConsentType.PRIVACY, granted=accepted_terms),
        ]
    )
    record_audit("account.registered", actor=user, target=user, request=request)
    transaction.on_commit(lambda: send_verification_email(user))
    from apps.notifications.models import Category
    from apps.notifications.services import notify

    notify(user, Category.SERVICE, "welcome", {}, dedupe_key="welcome", force=True)
    return user


def verify_email(token):
    data = read_email_verification_token(token)
    try:
        user = User.objects.get(pk=data["uid"], is_active=True)
    except User.DoesNotExist as exc:
        raise TokenError("token_invalid") from exc
    if user.email.lower() != data["email"].lower():
        raise TokenError("token_invalid")  # email changed since token was issued
    if not user.is_email_verified:
        user.is_email_verified = True
        user.email_verified_at = timezone.now()
        user.save(update_fields=["is_email_verified", "email_verified_at"])
        record_audit("account.email_verified", actor=user, target=user)
    return user


def request_password_reset(email):
    """Always silent to avoid account enumeration."""
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if not user:
        return
    app_link, web_link = _links("reset-password", make_password_reset_token(user))
    body = (
        "We received a request to reset your Zpot password.\n\n"
        f"Open this link on your phone: {app_link}\n\nOr: {web_link}\n\n"
        "The link expires in 2 hours and can be used once. If you didn't ask for this, ignore this email."
    )
    send_email_task.delay("Reset your Zpot password", body, user.email)
    record_audit("account.password_reset_requested", actor=user, target=user)


@transaction.atomic
def confirm_password_reset(token, new_password):
    user = read_password_reset_token(token, User)
    user.set_password(new_password)
    user.save(update_fields=["password"])
    revoke_all_refresh_tokens(user)
    record_audit("account.password_reset", actor=user, target=user)
    return user


def revoke_all_refresh_tokens(user):
    for tok in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=tok)


def logout(user, refresh, everywhere=False):
    if everywhere:
        revoke_all_refresh_tokens(user)
    else:
        token = RefreshToken(refresh)
        if str(token.get("user_id")) != str(user.pk):
            raise TokenError("token_not_owned")
        token.blacklist()
    record_audit("account.logout", actor=user, target=user, everywhere=everywhere)


@transaction.atomic
def delete_account(user, request=None):
    """GDPR erasure: personal data cascades. Audit row keeps no personal data (actor set NULL)."""
    record_audit("account.deleted", actor=None, target=user, request=None)
    revoke_all_refresh_tokens(user)
    user.delete()
