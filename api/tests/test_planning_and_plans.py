"""Vehicles, commute planner, savings & history, entitlements and Z-Trigger history/correction."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from freezegun import freeze_time

from apps.accounts.models import UserPreference
from apps.core.models import FeatureFlag
from apps.saved.commute import next_dates

from .conftest import area_id

pytestmark = pytest.mark.django_db
TZ = ZoneInfo("Europe/Lisbon")


def test_entitlement_is_honestly_free(make_client, api):
    assert api.get("/api/v1/billing/entitlement/").status_code == 401
    e = make_client().get("/api/v1/billing/entitlement/").json()
    assert e["plan"] == "free" and e["purchases_available"] is False and e["provider"] is None
    assert e["limits"]["vehicles"] == 1 and e["limits"]["insights_export"] is False


def test_vehicles_default_limit_activate_sync(seeded, make_client):
    c = make_client()
    vs = c.get("/api/v1/vehicles/").json()
    assert len(vs) == 1 and vs[0]["is_active"] and vs[0]["vehicle_class"] == "car"
    r = c.post("/api/v1/vehicles/", {"label": "Van", "vehicle_class": "van"}, format="json")
    assert r.status_code == 403 and r.json()["error"]["code"] == "plan_limit"
    vid = vs[0]["id"]
    p = c.patch(
        f"/api/v1/vehicles/{vid}/",
        {"vehicle_class": "motorcycle", "permit_type": "lisbon-resident-saldanha"},
        format="json",
    )
    assert p.status_code == 200 and p.json()["permit_name"]
    prefs = UserPreference.objects.get(user=c.user)
    assert prefs.vehicle_class == "motorcycle" and prefs.permit_type.code == "lisbon-resident-saldanha"
    act = c.post(f"/api/v1/vehicles/{vid}/activate/")
    assert act.status_code == 200 and act.json()["is_active"]
    assert c.patch(f"/api/v1/vehicles/{vid}/activate/", {"label": "x"}, format="json").status_code == 405
    assert make_client().post(f"/api/v1/vehicles/{vid}/activate/").status_code == 404
    assert c.delete(f"/api/v1/vehicles/{vid}/").status_code == 204
    prefs.refresh_from_db()
    assert prefs.vehicle_class == "car" and prefs.permit_type is None
    # other users cannot touch it
    vid2 = c.get("/api/v1/vehicles/").json()[0]["id"]
    assert make_client().patch(f"/api/v1/vehicles/{vid2}/", {"label": "x"}, format="json").status_code == 404


def test_next_dates_soonest_first():
    now = datetime(2026, 11, 16, 9, 0, tzinfo=TZ)  # Monday 09:00
    out = next_dates([0, 2], 8 * 60, now)  # 08:00 Monday already passed
    assert out[0][0] == 2 and out[0][1].day == 18 and out[1][1].day == 23


@freeze_time("2026-11-15 20:00:00+00:00")  # Sunday evening
def test_commute_check_free_plan_shows_soonest_day_only(seeded, make_client):
    c = make_client()
    body = {
        "label": "Office",
        "name": "Saldanha",
        "latitude": 38.7347,
        "longitude": -9.145,
        "days": [2, 0, 0],
        "arrival_minute": 600,
        "duration_minutes": 120,
    }
    r = c.post("/api/v1/commute/plans/", body, format="json")
    assert r.status_code == 201 and r.json()["days"] == [0, 2]
    pid = r.json()["id"]
    chk = c.get(f"/api/v1/commute/plans/{pid}/check/").json()
    d0, d1 = chk["days"]
    assert d0["weekday"] == 0 and d0["locked"] is False and d0["best"] is not None
    assert d0["best"]["category"] in ("free", "free_time_limited", "paid")  # never restricted/unknown as best
    assert d1["locked"] is True and d1["best"] is None
    assert make_client().get(f"/api/v1/commute/plans/{pid}/check/").status_code == 404
    bad = c.post("/api/v1/commute/plans/", {**body, "days": []}, format="json")
    assert bad.status_code == 400
    assert c.delete(f"/api/v1/commute/plans/{pid}/").status_code == 204


def test_insights_only_count_entered_costs(seeded, make_client):
    c = make_client()
    i0 = c.get("/api/v1/sessions/insights/").json()
    assert i0["sessions"] == 0 and i0["estimated_savings_total"] is None
    for cost in (None, "0.00"):
        sid = c.post("/api/v1/sessions/", {"area_id": area_id("s1"), "duration_minutes": 60}, format="json").json()[
            "session"
        ]["id"]
        c.post(f"/api/v1/sessions/{sid}/end/", {"cost_paid": cost} if cost else {}, format="json")
    i = c.get("/api/v1/sessions/insights/").json()
    assert i["sessions"] == 2 and i["sessions_with_cost"] == 1 and i["paid_total"] == "0.00"
    assert i["estimated_savings_sessions"] <= 1
    r = c.get("/api/v1/sessions/insights/export/")
    assert r.status_code == 403 and r.json()["error"]["code"] == "plan_required"


def test_z_trigger_history_correction_and_delete(seeded, make_client):
    from apps.core.features import invalidate

    FeatureFlag.objects.create(key="z_trigger", enabled=True)
    invalidate()
    try:
        c = make_client()
        e = c.post(
            "/api/v1/events/park/",
            {"latitude": 38.70, "longitude": -9.10, "detected_at": "2026-11-09T10:00:00Z", "source": "manual_test"},
            format="json",
        ).json()
        assert e["area"] is None
        fixed = c.post(
            f"/api/v1/events/park/{e['id']}/correct/", {"latitude": 38.7351, "longitude": -9.1478}, format="json"
        ).json()
        assert fixed["area"]["id"] == area_id("s1")
        assert [x["id"] for x in c.get("/api/v1/events/park/").json()] == [e["id"]]
        assert make_client().get("/api/v1/events/park/").json() == []
        assert c.delete("/api/v1/events/park/").json()["deleted"] == 1
        assert c.get("/api/v1/events/park/").json() == []
    finally:
        FeatureFlag.objects.all().delete()
        invalidate()
