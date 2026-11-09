from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from apps.notifications.models import Notification
from apps.sessions.models import ParkingReminder, ParkingSession, ParkingSessionEvent
from apps.sessions.services import dispatch_due, expire_stale

from .conftest import area_id, reauth

pytestmark = pytest.mark.django_db
URL = "/api/v1/sessions/"
# Monday 10:00 Lisbon (UTC+0 in November)
MON_10 = "2026-11-16 10:00:00+00:00"


def start(c, ref="s1", **kw):
    return c.post(URL, {"area_id": area_id(ref), "duration_minutes": kw.pop("duration", 120), **kw}, format="json")


@freeze_time(MON_10)
def test_start_session_persists_with_rule_snapshot(seeded, make_client):
    c = make_client()
    r = start(c)
    assert r.status_code == 201, r.json()
    s = r.json()["session"]
    assert s["status"] == "active" and s["category"] == "free"
    db = ParkingSession.objects.get(pk=s["id"])
    assert db.user == c.user and db.planned_end_at - db.started_at == timedelta(hours=2)
    # restriction deadline (legal) is separate from the planned departure (user)
    assert db.restriction_deadline is not None and db.restriction_deadline != db.planned_end_at
    kinds = set(db.reminders.values_list("kind", flat=True))
    assert kinds == {"planned_departure", "restriction_deadline"}
    assert ParkingSessionEvent.objects.filter(session=db, kind="started").exists()


@freeze_time(MON_10)
def test_cannot_start_where_parking_not_permitted(seeded, make_client):
    r = start(make_client(), ref="s4")  # residents only
    assert r.status_code == 409 and r.json()["error"]["code"] == "parking_not_permitted"
    assert ParkingSession.objects.count() == 0


@freeze_time(MON_10)
def test_only_one_active_session(seeded, make_client):
    c = make_client()
    assert start(c).status_code == 201
    r = start(c, ref="s3")
    assert r.status_code == 409 and r.json()["error"]["code"] == "active_session_exists"


@freeze_time(MON_10)
def test_edit_planned_departure_reevaluates_rules_and_warns(seeded, make_client):
    c = make_client()
    sid = start(c, ref="s7", duration=60).json()["session"]["id"]  # max stay 2 h
    r = c.patch(f"{URL}{sid}/", {"planned_end_at": "2026-11-16T13:30:00Z"}, format="json")
    assert r.status_code == 200
    body = r.json()
    assert body["session"]["category"] == "free_time_limited"
    assert any(w["code"] == "planned_end_after_deadline" for w in body["warnings"])
    assert ParkingSessionEvent.objects.filter(session_id=sid, kind="edited").exists()
    # old reminders cancelled, new ones scheduled
    assert ParkingReminder.objects.filter(session_id=sid, status="cancelled").exists()
    assert ParkingReminder.objects.filter(session_id=sid, status="scheduled").exists()


@freeze_time(MON_10)
def test_paid_session_warns_and_costs(seeded, make_client):
    r = start(make_client(), ref="s2", duration=120)
    assert r.json()["session"]["category"] == "paid"
    assert r.json()["session"]["expected_cost"] == "3.20"
    assert any(w["code"] == "paid_hours" for w in r.json()["warnings"])


@freeze_time(MON_10)
def test_end_is_idempotent_and_closes_reminders(seeded, make_client):
    c = make_client()
    sid = start(c).json()["session"]["id"]
    r1 = c.post(f"{URL}{sid}/end/", {"cost_paid": "0", "outcome": "easy"}, format="json")
    assert r1.status_code == 200 and r1.json()["already_ended"] is False
    assert r1.json()["session"]["status"] == "ended"
    r2 = c.post(f"{URL}{sid}/end/", {}, format="json")
    assert r2.status_code == 200 and r2.json()["already_ended"] is True
    assert not ParkingReminder.objects.filter(session_id=sid, status="scheduled").exists()
    edit = c.patch(f"{URL}{sid}/", {"reminder_minutes": 30}, format="json")
    assert edit.status_code == 409 and edit.json()["error"]["code"] == "session_not_active"
    assert c.get(f"{URL}active/").status_code == 204


@freeze_time(MON_10)
def test_end_with_departure_share_creates_report_and_observation(seeded, make_client):
    from apps.reports.models import CommunityReport

    c = make_client()
    sid = start(c).json()["session"]["id"]
    c.post(f"{URL}{sid}/end/", {"share_departure": True}, format="json")
    rep = CommunityReport.objects.get(reporter=c.user, type="leaving")
    assert rep.status == "published" and rep.observation is not None


@freeze_time(MON_10)
def test_summary_and_saving_estimate(seeded, make_client):
    c = make_client()
    sid = start(c).json()["session"]["id"]
    with freeze_time("2026-11-16 12:00:00+00:00"):
        reauth(c)
        c.post(f"{URL}{sid}/end/", {"cost_paid": "0"}, format="json")
        s = c.get(f"{URL}{sid}/summary/").json()
    assert s["duration_minutes"] == 120
    assert s["estimated_saving"]["amount"] and "estimate" in s["estimated_saving"]["note"]


@freeze_time(MON_10)
def test_other_users_cannot_see_or_modify_session(seeded, make_client):
    owner, other = make_client(), make_client()
    sid = start(owner).json()["session"]["id"]
    assert other.get(f"{URL}{sid}/").status_code == 404
    assert other.patch(f"{URL}{sid}/", {"reminder_minutes": 5}, format="json").status_code == 404
    assert other.post(f"{URL}{sid}/end/", {}, format="json").status_code == 404
    assert other.get(URL).json()["results"] == []


def test_guest_cannot_start_session(seeded, api):
    assert api.post(URL, {"area_id": area_id("s1")}, format="json").status_code == 401


@freeze_time(MON_10)
def test_validation(seeded, make_client):
    c = make_client()
    assert (
        c.post(URL, {"area_id": area_id("s1"), "planned_end_at": "2026-11-16T09:00:00Z"}, format="json").status_code
        == 400
    )
    assert c.post(URL, {"area_id": area_id("s1"), "duration_minutes": 5}, format="json").status_code == 400
    assert c.post(URL, {"area_id": 999999}, format="json").status_code == 404
    r = c.post(URL, {"area_id": area_id("s1"), "planned_end_at": "2026-11-17T12:00:00Z"}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_planned_end"


@freeze_time(MON_10)
def test_reminders_dispatch_once_and_create_notifications(seeded, make_client):
    c = make_client()
    sid = start(c, duration=60, reminder_minutes=15).json()["session"]["id"]
    assert dispatch_due() == 0
    with freeze_time("2026-11-16 10:46:00+00:00"):
        assert dispatch_due() == 1
        assert dispatch_due() == 0  # idempotent
    n = Notification.objects.get(user=c.user, category="session_reminder")
    assert n.target == {"route": "Session", "id": sid}
    assert n.push_status == "no_device"  # honest: no device registered, no provider
    r = ParkingReminder.objects.get(session_id=sid, kind="planned_departure")
    assert r.status == "sent" and r.notification_id == n.id


@freeze_time(MON_10)
def test_restriction_deadline_reminder_is_essential(seeded, make_client):
    c = make_client()
    c.patch("/api/v1/notifications/preferences/", {"session_reminders": False}, format="json")
    sid = start(c, ref="s7", duration=60).json()["session"]["id"]  # max stay 2h -> deadline 12:00
    with freeze_time("2026-11-16 11:31:00+00:00"):
        dispatch_due()
    assert Notification.objects.filter(user=c.user, category="restriction").count() == 1
    assert not Notification.objects.filter(user=c.user, category="session_reminder").exists()
    assert ParkingSession.objects.get(pk=sid).status == "active"


@freeze_time(MON_10)
def test_custom_reminder_add_and_delete(seeded, make_client):
    c = make_client()
    sid = start(c).json()["session"]["id"]
    r = c.post(f"{URL}{sid}/reminders/", {"minutes_before": 45}, format="json")
    assert r.status_code == 201
    rid = r.json()["id"]
    assert c.delete(f"{URL}{sid}/reminders/{rid}/").status_code == 204
    assert ParkingReminder.objects.get(pk=rid).status == "cancelled"
    assert c.post(f"{URL}{sid}/reminders/", {"minutes_before": 200}, format="json").status_code == 400  # in the past


@freeze_time(MON_10)
def test_stale_sessions_expire_not_end(seeded, make_client):
    c = make_client()
    sid = start(c).json()["session"]["id"]
    with freeze_time(timezone.now() + timedelta(hours=27)):
        assert expire_stale() == 1
        s = ParkingSession.objects.get(pk=sid)
        assert s.status == "expired" and s.ended_at == s.planned_end_at
        reauth(c)
        assert c.get(f"{URL}active/").status_code == 204
