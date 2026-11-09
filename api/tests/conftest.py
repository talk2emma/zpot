from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

LISBON = ZoneInfo("Europe/Lisbon")


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def seeded(db):
    call_command("seed_zpot_lisbon", verbosity=0)


def next_local(weekday: int, hour: int, minute: int = 0, weeks_ahead: int = 1) -> datetime:
    """Next occurrence (>= 1 day ahead) of a local Lisbon weekday/time, as an aware datetime."""
    today = datetime.now(LISBON).date()
    d = today + timedelta(days=1)
    while d.weekday() != weekday:
        d += timedelta(days=1)
    d += timedelta(weeks=weeks_ahead - 1)
    return datetime.combine(d, time(hour, minute), tzinfo=LISBON)


@pytest.fixture
def user_factory(db):
    from apps.accounts.services import register_user

    def make(email="rita@example.pt", password="Str0ng-pass-123", verified=False):
        u = register_user(email=email, password=password, display_name="Rita")
        if verified:
            u.is_email_verified = True
            u.save()
        return u

    return make


@pytest.fixture
def auth_api(api, user_factory):
    from apps.accounts.services import issue_tokens

    user = user_factory()
    tokens = issue_tokens(user)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    api.user, api.tokens = user, tokens
    return api


@pytest.fixture
def make_client(db):
    """Authenticated APIClient for a fresh user, optionally with roles."""
    from apps.accounts.models import UserRole
    from apps.accounts.services import issue_tokens, register_user

    counter = {"n": 0}

    def make(roles=(), email=None):
        counter["n"] += 1
        u = register_user(email=email or f"user{counter['n']}@zpot.test", password="Str0ng-pass-123")
        for r in roles:
            UserRole.objects.get_or_create(user=u, role=r)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_tokens(u)['access']}")
        c.user = u
        return c

    return make


def area_id(ref):
    from apps.parking.models import ParkingArea

    return ParkingArea.objects.get(external_ref=f"dev-lisbon-{ref}").id


def guest(token="guest-install-token-0001"):
    c = APIClient()
    c.credentials(HTTP_X_ZPOT_CLIENT=token)
    return c


def reauth(c):
    """Issue a fresh access token (for tests that move the clock past the 15-minute lifetime)."""
    from apps.accounts.services import issue_tokens

    c.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_tokens(c.user)['access']}")
    return c
