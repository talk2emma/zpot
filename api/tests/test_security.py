"""Cross-cutting authorisation and input-safety checks."""

import pytest
from freezegun import freeze_time

from .conftest import area_id

pytestmark = pytest.mark.django_db

PROTECTED = [
    ("get", "/api/v1/sessions/"),
    ("post", "/api/v1/sessions/"),
    ("get", "/api/v1/sessions/active/"),
    ("get", "/api/v1/saved/locations/"),
    ("get", "/api/v1/notifications/"),
    ("post", "/api/v1/devices/"),
    ("get", "/api/v1/privacy/consents/"),
    ("post", "/api/v1/privacy/data-export/"),
    ("get", "/api/v1/support/tickets/"),
    ("get", "/api/v1/scouts/assignments/"),
    ("get", "/api/v1/reports/"),
]


@pytest.mark.parametrize("method,url", PROTECTED)
def test_guest_cannot_reach_protected_endpoints(seeded, api, method, url):
    assert getattr(api, method)(url, {}, format="json").status_code in (401, 403)


def test_invalid_and_expired_jwt_rejected(seeded, make_client, api):
    api.credentials(HTTP_AUTHORIZATION="Bearer not.a.jwt")
    r = api.get("/api/v1/users/me/")
    assert r.status_code == 401 and r.json()["error"]["code"] in ("token_not_valid", "authentication_failed")
    c = make_client()
    with freeze_time("2099-01-01"):
        assert c.get("/api/v1/users/me/").status_code == 401


def test_users_cannot_edit_others_reports(seeded, make_client):
    from apps.parking.models import ParkingArea

    a = ParkingArea.objects.get(external_ref="dev-lisbon-s2")
    owner, other = make_client(), make_client()
    rid = owner.post(
        "/api/v1/reports/",
        {
            "type": "new_sign",
            "latitude": a.location.y,
            "longitude": a.location.x,
            "description": "New loading bay sign",
        },
        format="json",
    ).json()["id"]
    assert other.get(f"/api/v1/reports/{rid}/").status_code == 404
    assert other.patch(f"/api/v1/reports/{rid}/", {"description": "hacked!!!!!!"}, format="json").status_code == 404
    assert (
        owner.patch(f"/api/v1/reports/{rid}/", {"description": "Updated description"}, format="json").status_code == 200
    )


def test_non_scout_cannot_submit_scout_task(seeded, make_client):
    from apps.scouts.models import ScoutAssignment

    a = ScoutAssignment.objects.create(area_id=area_id("s5"), reason="x")
    assert make_client().post(f"/api/v1/scouts/assignments/{a.id}/submit/", {"outcome": "matches"}).status_code == 403


def test_invalid_coordinates_rejected_everywhere(seeded, make_client, api):
    assert (
        api.get("/api/v1/parking/options/", {"destination_latitude": 200, "destination_longitude": 0}).status_code
        == 400
    )
    assert api.get("/api/v1/availability/nearby/", {"latitude": 99, "longitude": 0}).status_code == 400
    c = make_client()
    assert (
        c.post("/api/v1/reports/", {"type": "found", "latitude": "abc", "longitude": 0}, format="json").status_code
        == 400
    )


def test_report_throttle_enforced(seeded, make_client, settings):
    from django.core.cache import cache
    from rest_framework.settings import api_settings
    from rest_framework.throttling import SimpleRateThrottle

    rates = {**api_settings.DEFAULT_THROTTLE_RATES, "reports": "2/hour"}
    old = SimpleRateThrottle.THROTTLE_RATES
    SimpleRateThrottle.THROTTLE_RATES = rates
    cache.clear()
    try:
        c = make_client()
        from apps.parking.models import ParkingArea

        codes = []
        for ref in ("s1", "s3", "a2"):
            a = ParkingArea.objects.get(external_ref=f"dev-lisbon-{ref}")
            codes.append(
                c.post(
                    "/api/v1/reports/",
                    {"type": "found", "latitude": a.location.y, "longitude": a.location.x},
                    format="json",
                ).status_code
            )
        assert codes[:2] == [201, 201] and codes[2] == 429
    finally:
        SimpleRateThrottle.THROTTLE_RATES = old
        cache.clear()


def test_errors_never_leak_stack_traces(seeded, api):
    r = api.get("/api/v1/parking/areas/abc/")
    assert r.status_code == 404 and "Traceback" not in r.content.decode()
