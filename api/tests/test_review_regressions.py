"""Regression tests for defects confirmed in the 2026-11 code review (docs/code-review/REMEDIATION_LOG.md).

Sessions use area m1 (free, no time windows) so the tests never depend on the wall clock: s1 has a Tuesday
07:00–09:00 street-cleaning ban, during which starting a session there is (correctly) refused."""

from datetime import timedelta
from unittest import mock

import pytest
from django.db import IntegrityError
from django.db.models import QuerySet
from django.utils import timezone

from apps.core.models import FeatureFlag
from apps.notifications.models import Notification
from apps.sessions.models import ParkingSession

from .conftest import area_id, guest

pytestmark = pytest.mark.django_db


def test_a01_lists_are_newest_first_not_uuid_order(seeded, make_client):
    c = make_client()
    now = timezone.now()
    for i in range(6):
        n = Notification.objects.create(user=c.user, category="service", title=f"n{i}", body="b", dedupe_key=f"o{i}")
        Notification.objects.filter(pk=n.pk).update(created_at=now - timedelta(minutes=10 - i))
    titles = [x["title"] for x in c.get("/api/v1/notifications/").json()["results"] if x["title"].startswith("n")]
    assert titles == [f"n{i}" for i in reversed(range(6))]
    for i in range(4):
        s = c.post("/api/v1/sessions/", {"area_id": area_id("m1"), "duration_minutes": 60}, format="json").json()[
            "session"
        ]
        ParkingSession.objects.filter(pk=s["id"]).update(started_at=now - timedelta(days=4 - i))
        c.post(f"/api/v1/sessions/{s['id']}/end/", {}, format="json")
    started = [x["started_at"] for x in c.get("/api/v1/sessions/").json()["results"]]
    assert started == sorted(started, reverse=True)


def test_a02_concurrent_start_race_is_a_409_not_a_500(seeded, make_client):
    c = make_client()
    assert c.post("/api/v1/sessions/", {"area_id": area_id("m1")}, format="json").status_code == 201
    # Simulate the race: the pre-check sees no active session, the partial unique constraint fires on insert.
    with mock.patch.object(QuerySet, "exists", return_value=False):
        r = c.post("/api/v1/sessions/", {"area_id": area_id("m1")}, format="json")
    assert r.status_code == 409 and r.json()["error"]["code"] == "active_session_exists"


def test_a02_any_integrity_error_uses_the_error_envelope(seeded, make_client):
    c = make_client()
    with mock.patch("apps.saved.views._save", side_effect=IntegrityError("dup")):
        r = c.post("/api/v1/saved/locations/", {"area_id": area_id("s1")}, format="json")
    assert r.status_code == 409 and r.json()["error"]["code"] == "conflict"


def test_a03_ending_a_session_never_fails_because_the_departure_share_is_rejected(seeded, make_client):
    c = make_client()
    for _ in range(2):  # second share at the same spot within 10 min is a duplicate report
        sid = c.post("/api/v1/sessions/", {"area_id": area_id("m1")}, format="json").json()["session"]["id"]
        r = c.post(f"/api/v1/sessions/{sid}/end/", {"share_departure": True}, format="json")
        assert r.status_code == 200, r.content
        assert r.json()["session"]["status"] == "ended"


def test_a04_commute_patch_with_one_coordinate_is_a_400(seeded, make_client):
    c = make_client()
    pid = c.post(
        "/api/v1/commute/plans/",
        {
            "label": "x",
            "name": "x",
            "latitude": 38.73,
            "longitude": -9.14,
            "days": [0],
            "arrival_minute": 540,
            "duration_minutes": 60,
        },
        format="json",
    ).json()["id"]
    assert c.patch(f"/api/v1/commute/plans/{pid}/", {"latitude": 38.74}, format="json").status_code == 400


@pytest.mark.parametrize("qs", ["area=abc", "bbox=1,2,3", "bbox=a,b,c,d"])
def test_a05_observation_filters_validate_input(seeded, api, qs):
    r = api.get(f"/api/v1/availability/observations/?{qs}")
    assert r.status_code == 400 and r.json()["error"]["code"] == "validation_error"


def test_a06_area_detail_rejects_non_numeric_coordinates(seeded, api):
    r = api.get(f"/api/v1/parking/areas/{area_id('s1')}/?latitude=abc&longitude=-9.1")
    assert r.status_code == 400


def test_a07_guest_cannot_confirm_own_report_and_guest_votes_do_not_extend_expiry(seeded):
    me = guest("guest-reporter-token-0001")
    rep = me.post(
        "/api/v1/reports/",
        {
            "type": "found",
            "area_id": area_id("s1"),
            "latitude": 38.7351,
            "longitude": -9.1478,
            "device_latitude": 38.7351,
            "device_longitude": -9.1478,
        },
        format="json",
    ).json()
    assert rep["observation"], rep
    r = me.post(f"/api/v1/reports/{rep['id']}/verifications/", {"answer": "still_available"}, format="json")
    assert r.status_code == 403 and r.json()["error"]["code"] == "own_observation"
    before = rep["observation"]["expires_at"]
    other = guest("another-guest-token-0002")
    r = other.post(f"/api/v1/reports/{rep['id']}/verifications/", {"answer": "still_available"}, format="json").json()
    assert r["confirmations"] == rep["observation"]["confirmations"] + 1 and r["expires_at"] == before


@pytest.mark.parametrize(
    "flag,method,path",
    [
        ("community_reports", "post", "/api/v1/reports/"),
        ("parking_sessions", "post", "/api/v1/sessions/"),
        ("support", "post", "/api/v1/support/tickets/"),
    ],
)
def test_a09_feature_flags_are_enforced_server_side(seeded, make_client, flag, method, path):
    from apps.core.features import invalidate

    FeatureFlag.objects.create(key=flag, enabled=False)
    invalidate()
    try:
        r = getattr(make_client(), method)(path, {}, format="json")
        assert r.status_code == 403 and r.json()["error"]["code"] == "feature_disabled"
    finally:
        FeatureFlag.objects.all().delete()
        invalidate()


def test_a10_import_skips_unknown_or_inactive_areas(seeded, make_client):
    from apps.parking.models import ParkingArea

    ParkingArea.objects.filter(pk=area_id("s2")).update(is_active=False)
    r = make_client().post(
        "/api/v1/saved/locations/import/",
        {"items": [{"area_id": area_id("s1")}, {"area_id": area_id("s2")}, {"area_id": 999999}]},
        format="json",
    )
    assert r.status_code == 200 and r.json()["imported"] == 1


def test_a12_reading_my_sessions_does_not_touch_other_users(seeded, make_client):
    a, b = make_client(), make_client()
    sid = a.post("/api/v1/sessions/", {"area_id": area_id("m1")}, format="json").json()["session"]["id"]
    ParkingSession.objects.filter(pk=sid).update(
        planned_end_at=timezone.now() - timedelta(hours=30), started_at=timezone.now() - timedelta(hours=31)
    )
    b.get("/api/v1/sessions/")
    assert ParkingSession.objects.get(pk=sid).status == "active"  # only the owner's read (or the beat task) expires it
    a.get("/api/v1/sessions/active/")
    assert ParkingSession.objects.get(pk=sid).status == "expired"


def test_a17_insights_query_count_is_bounded(seeded, make_client, django_assert_max_num_queries):
    from decimal import Decimal

    c = make_client()
    now = timezone.now()
    ParkingSession.objects.bulk_create(
        [
            ParkingSession(
                user=c.user,
                area_id=area_id("s1" if i % 2 else "s2"),
                status="ended",
                started_at=now - timedelta(days=i + 1),
                planned_end_at=now - timedelta(days=i + 1) + timedelta(hours=2),
                ended_at=now - timedelta(days=i + 1) + timedelta(hours=2),
                category="free",
                legal_status="permitted",
                evaluated_at=now,
                cost_paid=Decimal("1.00") if i % 2 else None,
            )
            for i in range(40)
        ]
    )
    with django_assert_max_num_queries(12):
        r = c.get("/api/v1/sessions/insights/")
    d = r.json()
    assert d["sessions"] == 40 and d["parked_minutes"] == 40 * 120 and d["sessions_with_cost"] == 20


def test_a18_editing_the_plan_keeps_custom_reminders(seeded, make_client):
    c = make_client()
    sid = c.post("/api/v1/sessions/", {"area_id": area_id("m1"), "duration_minutes": 180}, format="json").json()[
        "session"
    ]["id"]
    c.post(f"/api/v1/sessions/{sid}/reminders/", {"minutes_before": 45}, format="json")
    c.patch(f"/api/v1/sessions/{sid}/", {"reminder_minutes": 10}, format="json")
    kinds = {(r["kind"], r["minutes_before"], r["status"]) for r in c.get(f"/api/v1/sessions/{sid}/reminders/").json()}
    assert any(k[0] == "custom" and k[1] == 45 and k[2] == "scheduled" for k in kinds), kinds


def test_a26_evaluate_ignores_inactive_areas(seeded, api):
    from apps.parking.models import ParkingArea

    ParkingArea.objects.filter(pk=area_id("s1")).update(is_active=False)
    r = api.post("/api/v1/regulations/evaluate/", {"area_id": area_id("s1"), "duration_minutes": 60}, format="json")
    assert r.status_code == 404


def test_p01_map_geometry_is_sent_at_6_decimal_precision(seeded, api):
    """~11 cm precision is far beyond what a map needs; full float precision inflated map-layers payloads ~2x."""
    import json

    r = api.get("/api/v1/parking/map-layers/?bbox=-9.155,38.728,-9.135,38.742&duration_minutes=120")
    coords = json.dumps([f["geometry"]["coordinates"] for f in r.json()["features"]])
    import re

    assert not re.search(r"\.\d{7,}", coords)
