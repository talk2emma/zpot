"""Email verification (signed, time-limited) and password reset (single-use) tokens."""

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

_SALT = "zpot.email-verification.v1"


class TokenError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def make_email_verification_token(user):
    return signing.TimestampSigner(salt=_SALT).sign_object({"uid": str(user.pk), "email": user.email})


def read_email_verification_token(token):
    try:
        data = signing.TimestampSigner(salt=_SALT).unsign_object(
            token, max_age=settings.EMAIL_VERIFICATION_MAX_AGE_SECONDS
        )
    except signing.SignatureExpired as exc:
        raise TokenError("token_expired") from exc
    except signing.BadSignature as exc:
        raise TokenError("token_invalid") from exc
    return data


def make_password_reset_token(user):
    """Returns '<uidb64>.<token>'; invalidated by a password change or login (Django token generator)."""
    return f"{urlsafe_base64_encode(force_bytes(user.pk))}.{default_token_generator.make_token(user)}"


def read_password_reset_token(raw, user_model):
    try:
        uidb64, token = raw.split(".", 1)
        user = user_model.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)), is_active=True)
    except (ValueError, TypeError, OverflowError, user_model.DoesNotExist) as exc:
        raise TokenError("token_invalid") from exc
    if not default_token_generator.check_token(user, token):
        raise TokenError("token_invalid_or_expired")
    return user
