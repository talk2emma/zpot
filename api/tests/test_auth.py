import re

import pytest
from django.core import mail
from django.test import override_settings

from apps.accounts.models import ConsentRecord, User

pytestmark = pytest.mark.django_db

REG = "/api/v1/auth/register/"


def _token_from_mail(kind):
    body = mail.outbox[-1].body
    m = re.search(rf"zpot://{kind}\?token=([^\s]+)", body)
    from urllib.parse import unquote

    return unquote(m.group(1))


def register(api, email="new@zpot.pt", password="Str0ng-pass-123", **kw):
    data = {"email": email, "password": password, "accept_terms": True, **kw}
    return api.post(REG, data, format="json")


def test_register_valid_returns_tokens_and_sends_verification(api, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        r = register(api, email="Rita@Example.pt")
    assert r.status_code == 201, r.json()
    body = r.json()
    assert body["user"]["email"] == "rita@example.pt"
    assert body["user"]["is_email_verified"] is False
    assert body["tokens"]["access"] and body["tokens"]["refresh"]
    assert len(mail.outbox) == 1 and "zpot://verify-email?token=" in mail.outbox[0].body
    u = User.objects.get(email="rita@example.pt")
    assert u.check_password("Str0ng-pass-123") and not u.password.startswith("Str0ng")
    assert set(ConsentRecord.objects.filter(user=u).values_list("consent_type", flat=True)) == {"terms", "privacy"}


def test_register_duplicate_email_case_insensitive(api):
    assert register(api, email="dup@zpot.pt").status_code == 201
    r = register(api, email="DUP@zpot.pt")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "validation_error"
    assert "email" in r.json()["error"]["details"]


@pytest.mark.parametrize("pw", ["short1", "password123", "12345678901"])
def test_register_invalid_password(api, pw):
    r = register(api, password=pw)
    assert r.status_code == 400
    assert User.objects.count() == 0


def test_register_requires_terms(api):
    r = api.post(REG, {"email": "a@zpot.pt", "password": "Str0ng-pass-123", "accept_terms": False}, format="json")
    assert r.status_code == 400 and "accept_terms" in r.json()["error"]["details"]


def test_login_and_invalid_credentials(api, user_factory):
    user_factory(email="login@zpot.pt")
    ok = api.post("/api/v1/auth/login/", {"email": "LOGIN@zpot.pt", "password": "Str0ng-pass-123"}, format="json")
    assert ok.status_code == 200 and ok.json()["tokens"]["access"]
    bad = api.post("/api/v1/auth/login/", {"email": "login@zpot.pt", "password": "wrong-pass-1"}, format="json")
    assert bad.status_code == 401 and bad.json()["error"]["code"] == "invalid_credentials"
    unknown = api.post("/api/v1/auth/login/", {"email": "nobody@zpot.pt", "password": "x"}, format="json")
    assert unknown.status_code == 401


def test_email_verification_flow(api, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        register(api, email="v@zpot.pt")
    token = _token_from_mail("verify-email")
    r = api.post("/api/v1/auth/verify-email/", {"token": token}, format="json")
    assert r.status_code == 200 and r.json()["is_email_verified"] is True
    assert User.objects.get(email="v@zpot.pt").email_verified_at is not None
    bad = api.post("/api/v1/auth/verify-email/", {"token": token + "x"}, format="json")
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "token_invalid"


def test_expired_verification_token(api, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        register(api, email="exp@zpot.pt")
    token = _token_from_mail("verify-email")
    with override_settings(EMAIL_VERIFICATION_MAX_AGE_SECONDS=-1):
        r = api.post("/api/v1/auth/verify-email/", {"token": token}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "token_expired"


def test_resend_verification(auth_api):
    r = auth_api.post("/api/v1/auth/resend-verification/")
    assert r.status_code == 202 and len(mail.outbox) >= 1
    auth_api.user.is_email_verified = True
    auth_api.user.save()
    assert auth_api.post("/api/v1/auth/resend-verification/").status_code == 409


def test_password_reset_flow_and_single_use(api, user_factory):
    user_factory(email="reset@zpot.pt")
    r = api.post("/api/v1/auth/password-reset/", {"email": "reset@zpot.pt"}, format="json")
    assert r.status_code == 202
    token = _token_from_mail("reset-password")
    ok = api.post(
        "/api/v1/auth/password-reset/confirm/", {"token": token, "new_password": "N3w-strong-pass"}, format="json"
    )
    assert ok.status_code == 200
    login = api.post("/api/v1/auth/login/", {"email": "reset@zpot.pt", "password": "N3w-strong-pass"}, format="json")
    assert login.status_code == 200
    again = api.post(
        "/api/v1/auth/password-reset/confirm/", {"token": token, "new_password": "An0ther-pass-9"}, format="json"
    )
    assert again.status_code == 400


def test_password_reset_unknown_email_is_silent(api):
    r = api.post("/api/v1/auth/password-reset/", {"email": "ghost@zpot.pt"}, format="json")
    assert r.status_code == 202 and len(mail.outbox) == 0


def test_token_refresh_rotates(api, user_factory):
    from apps.accounts.services import issue_tokens

    t = issue_tokens(user_factory())
    r = api.post("/api/v1/auth/refresh/", {"refresh": t["refresh"]}, format="json")
    assert r.status_code == 200 and r.json()["access"] and r.json()["refresh"] != t["refresh"]
    reuse = api.post("/api/v1/auth/refresh/", {"refresh": t["refresh"]}, format="json")
    assert reuse.status_code == 401  # rotated token is blacklisted


def test_logout_revokes_refresh_token(auth_api):
    r = auth_api.post("/api/v1/auth/logout/", {"refresh": auth_api.tokens["refresh"]}, format="json")
    assert r.status_code == 204
    again = auth_api.post("/api/v1/auth/refresh/", {"refresh": auth_api.tokens["refresh"]}, format="json")
    assert again.status_code == 401


def test_unauthorized_access(api):
    for method, url in (
        ("get", "/api/v1/users/me/"),
        ("patch", "/api/v1/users/me/"),
        ("get", "/api/v1/users/me/preferences/"),
        ("post", "/api/v1/auth/logout/"),
    ):
        r = getattr(api, method)(url, {}, format="json")
        assert r.status_code == 401, url
        assert r.json()["error"]["code"] in ("not_authenticated", "authentication_failed")


def test_profile_get_and_update(auth_api):
    me = auth_api.get("/api/v1/users/me/").json()
    assert me["email"] == "rita@example.pt" and me["roles"] == ["driver"]
    r = auth_api.patch("/api/v1/users/me/", {"display_name": "Rita S.", "email": "hacker@x.pt"}, format="json")
    assert r.status_code == 200 and r.json()["display_name"] == "Rita S."
    assert r.json()["email"] == "rita@example.pt"  # read-only


def test_preferences_update_and_consent_ledger(auth_api, seeded):
    r = auth_api.patch(
        "/api/v1/users/me/preferences/",
        {
            "language": "pt-PT",
            "max_walk_minutes": 15,
            "analytics_opt_in": True,
            "permit_type": "lisbon-resident-saldanha",
        },
        format="json",
    )
    assert r.status_code == 200, r.json()
    assert r.json()["language"] == "pt-PT" and r.json()["permit_type"] == "lisbon-resident-saldanha"
    assert ConsentRecord.objects.filter(user=auth_api.user, consent_type="analytics", granted=True).exists()
    bad = auth_api.patch("/api/v1/users/me/preferences/", {"max_walk_minutes": 99}, format="json")
    assert bad.status_code == 400


def test_account_deletion(auth_api):
    bad = auth_api.delete("/api/v1/users/me/", {"confirm": "nope"}, format="json")
    assert bad.status_code == 400
    r = auth_api.delete("/api/v1/users/me/", {"confirm": "DELETE"}, format="json")
    assert r.status_code == 204
    assert not User.objects.filter(email="rita@example.pt").exists()
    assert auth_api.get("/api/v1/users/me/").status_code == 401
