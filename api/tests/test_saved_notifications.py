import pytest
from freezegun import freeze_time

from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.saved.models import SavedParkingLocation

from .conftest import area_id

pytestmark = pytest.mark.django_db


def test_save_rename_remove_location(seeded, make_client):
    c = make_client()
    r = c.post("/api/v1/saved/locations/", {"area_id": area_id("a2"), "label": "Gym — Alvalade"}, format="json")
    assert r.status_code == 201 and r.json()["label"] == "Gym — Alvalade"
    sid = r.json()["id"]
    again = c.post("/api/v1/saved/locations/", {"area_id": area_id("a2")}, format="json")
    assert again.status_code == 200 and again.json()["id"] == sid  # idempotent
    lst = c.get("/api/v1/saved/locations/").json()
    assert (
        lst[0]["current"]["category"] in ("free", "free_time_limited") and lst[0]["current"]["rules_changed"] is False
    )
    assert c.patch(f"/api/v1/saved/locations/{sid}/", {"label": "  "}, format="json").status_code == 400
    assert c.patch(f"/api/v1/saved/locations/{sid}/", {"label": "Gym"}, format="json").json()["label"] == "Gym"
    assert c.delete(f"/api/v1/saved/locations/{sid}/").status_code == 204
    assert not SavedParkingLocation.objects.filter(pk=sid).exists()
    assert c.post("/api/v1/saved/locations/", {"area_id": 99999}, format="json").status_code == 400


def test_saved_location_flags_rule_change(seeded, make_client):
    from datetime import timedelta

    from django.utils import timezone

    from apps.regulations.models import TemporaryClosure

    c = make_client()
    c.post("/api/v1/saved/locations/", {"area_id": area_id("s1")}, format="json")
    TemporaryClosure.objects.create(
        area_id=area_id("s1"),
        reason="Works (test)",
        starts_at=timezone.now() - timedelta(hours=1),
        ends_at=timezone.now() + timedelta(days=2),
    )
    cur = c.get("/api/v1/saved/locations/").json()[0]["current"]
    assert cur["category"] == "restricted" and cur["rules_changed"] is True


def test_guest_saved_import_is_idempotent(seeded, make_client):
    c = make_client()
    items = {"items": [{"area_id": area_id("s1")}, {"area_id": area_id("a2"), "label": "Gym"}]}
    assert c.post("/api/v1/saved/locations/import/", items, format="json").json() == {"imported": 2, "already_saved": 0}
    assert c.post("/api/v1/saved/locations/import/", items, format="json").json() == {"imported": 0, "already_saved": 2}


def test_saved_destinations_and_recent_searches(seeded, make_client):
    c = make_client()
    d = c.post(
        "/api/v1/saved/destinations/",
        {"label": "Work", "name": "Campo Pequeno", "latitude": 38.7425, "longitude": -9.1465},
        format="json",
    )
    assert d.status_code == 201
    assert (
        c.post(
            "/api/v1/saved/destinations/",
            {"label": "work", "name": "x", "latitude": 38.7, "longitude": -9.1},
            format="json",
        ).status_code
        == 409
    )
    assert c.delete(f"/api/v1/saved/destinations/{d.json()['id']}/").status_code == 204
    for _ in range(2):
        c.post(
            "/api/v1/searches/recent/",
            {"place_ref": "saldanha", "name": "Saldanha", "latitude": 38.73, "longitude": -9.14},
            format="json",
        )
    assert len(c.get("/api/v1/searches/recent/").json()) == 1
    assert c.delete("/api/v1/searches/recent/").status_code == 204
    assert c.get("/api/v1/searches/recent/").json() == []


def test_saved_endpoints_require_auth_and_ownership(seeded, make_client, api):
    assert api.get("/api/v1/saved/locations/").status_code == 401
    owner, other = make_client(), make_client()
    sid = owner.post("/api/v1/saved/locations/", {"area_id": area_id("s1")}, format="json").json()["id"]
    assert other.delete(f"/api/v1/saved/locations/{sid}/").status_code == 404
    assert other.patch(f"/api/v1/saved/locations/{sid}/", {"label": "mine"}, format="json").status_code == 404


def test_notifications_inbox_read_and_preferences(seeded, make_client):
    c = make_client()
    lst = c.get("/api/v1/notifications/").json()
    assert lst["unread_count"] == 1 and lst["results"][0]["template"] == "welcome"  # created at registration
    nid = lst["results"][0]["id"]
    assert c.get(f"/api/v1/notifications/{nid}/").json()["is_read"] is False
    assert c.post(f"/api/v1/notifications/{nid}/read/").json()["is_read"] is True
    notify(c.user, "service", "welcome", {}, dedupe_key="x1", force=True)
    notify(c.user, "service", "welcome", {}, dedupe_key="x1", force=True)  # dedupe
    assert Notification.objects.filter(user=c.user, dedupe_key="x1").count() == 1
    assert c.post("/api/v1/notifications/read-all/").json()["updated"] == 1
    p = c.patch("/api/v1/notifications/preferences/", {"rule_changes": False}, format="json").json()
    assert p["rule_changes"] is False and p["restriction_alerts"] is True
    assert notify(c.user, "rule_change", "rule_change", {"place": "X", "detail": "y"}, dedupe_key="rc") is None
    assert (
        notify(
            c.user,
            "restriction",
            "restriction_deadline",
            {"time": "12:00", "place": "X", "reason": "r"},
            dedupe_key="rd",
        )
        is not None
    )  # essential: always delivered


def test_notification_language_follows_preferences(seeded, make_client):
    c = make_client()
    c.patch("/api/v1/users/me/preferences/", {"language": "pt-PT"}, format="json")
    n = notify(
        c.user,
        "restriction",
        "restriction_deadline",
        {"time": "12:00", "place": "Rua X", "reason": "limpeza"},
        dedupe_key="pt",
    )
    assert n.title.startswith("Restrição")


def test_devices_and_push_status(seeded, make_client):
    c = make_client()
    r = c.post(
        "/api/v1/devices/", {"platform": "ios", "push_token": "dev-token-123", "app_version": "1.0"}, format="json"
    )
    assert r.status_code == 201
    assert (
        c.post("/api/v1/devices/", {"platform": "ios", "push_token": "dev-token-123"}, format="json").status_code == 200
    )
    n = notify(
        c.user, "restriction", "restriction_deadline", {"time": "1", "place": "p", "reason": "r"}, dedupe_key="d1"
    )
    assert n.push_status == "not_configured"  # honest: no APNs/FCM credentials
    other = make_client()
    assert other.delete(f"/api/v1/devices/{r.json()['id']}/").status_code == 404
    assert c.delete(f"/api/v1/devices/{r.json()['id']}/").status_code == 204
    assert other.get(f"/api/v1/notifications/{n.id}/").status_code == 404


@freeze_time("2026-11-16 10:00:00+00:00")
def test_notification_for_reminder_deep_links_to_session(seeded, make_client):
    from apps.sessions.services import dispatch_due

    c = make_client()
    sid = c.post(
        "/api/v1/sessions/", {"area_id": area_id("s1"), "duration_minutes": 30, "reminder_minutes": 15}, format="json"
    ).json()["session"]["id"]
    with freeze_time("2026-11-16 10:16:00+00:00"):
        dispatch_due()
    n = Notification.objects.get(user=c.user, category="session_reminder")
    assert n.target == {"route": "Session", "id": sid} and "left on your parking" in n.title
