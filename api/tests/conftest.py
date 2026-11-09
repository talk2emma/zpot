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
