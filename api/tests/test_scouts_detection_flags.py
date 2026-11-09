import io

import pytest
from PIL import Image

from apps.core.models import FeatureFlag
from apps.parking.models import ParkingArea, ParkingEvidence
from apps.scouts.models import ScoutAssignment
from apps.scouts.services import review

from .conftest import area_id

pytestmark = pytest.mark.django_db


def _png():
    b = io.BytesIO()
    Image.new("RGB", (40, 40), (10, 200, 10)).save(b, format="PNG")
    b.seek(0)
    b.name = "sign.png"
    return b


def test_scout_only_access_and_submit_review_workflow(seeded, make_client):
    scout, reviewer, plain = make_client(roles=["scout"]), make_client(roles=["data_reviewer"]), make_client()
    a = ScoutAssignment.objects.create(area_id=area_id("s7"), assigned_to=scout.user, reason="Conflicting reports")
    assert plain.get("/api/v1/scouts/assignments/").status_code == 403
    lst = scout.get("/api/v1/scouts/assignments/").json()
    assert lst[0]["id"] == a.id and lst[0]["current_rules"]
    assert make_client(roles=["scout"]).get(f"/api/v1/scouts/assignments/{a.id}/").status_code == 404  # not assigned
    nophoto = scout.post(f"/api/v1/scouts/assignments/{a.id}/submit/", {"outcome": "matches"}, format="multipart")
    assert nophoto.status_code == 400
    ok = scout.post(
        f"/api/v1/scouts/assignments/{a.id}/submit/", {"outcome": "matches", "photos": [_png()]}, format="multipart"
    )
    assert ok.status_code == 201 and ok.json()["status"] == "submitted"
    again = scout.post(
        f"/api/v1/scouts/assignments/{a.id}/submit/", {"outcome": "matches", "photos": [_png()]}, format="multipart"
    )
    assert again.status_code == 409
    sub = a.submissions.get()
    area = ParkingArea.objects.get(pk=area_id("s7"))
    assert area.verification_status == "community"
    review(sub, reviewer=reviewer.user, approve=True)
    area.refresh_from_db()
    a.refresh_from_db()
    assert a.status == "approved" and area.verification_status == "verified"
    assert ParkingEvidence.objects.filter(area=area, kind="scout_visit").exists()
    from apps.core.models import AuditEvent

    assert AuditEvent.objects.filter(action="scout.reviewed").exists()
    # API now reflects the canonical update
    d = plain.get(f"/api/v1/parking/areas/{area.id}/").json()
    assert d["verification_status"] == "verified"


def test_z_trigger_disabled_by_default(seeded, make_client, api):
    cfg = api.get("/api/v1/detection/config/").json()
    assert cfg["enabled"] is False and cfg["phase"] == "experimental"
    c = make_client()
    r = c.post(
        "/api/v1/events/park/",
        {"latitude": 38.735, "longitude": -9.148, "detected_at": "2026-11-16T10:00:00Z"},
        format="json",
    )
    assert r.status_code == 403 and r.json()["error"]["code"] == "feature_disabled"


def test_z_trigger_when_enabled_is_private_and_creates_no_observation(seeded, make_client):
    from apps.availability.models import ParkingObservation
    from apps.core.features import invalidate

    FeatureFlag.objects.create(key="z_trigger", enabled=True)
    invalidate()
    c = make_client()
    e = c.post(
        "/api/v1/events/park/",
        {"latitude": 38.7351, "longitude": -9.1478, "detected_at": "2026-11-16T10:00:00Z"},
        format="json",
    ).json()
    assert e["status"] == "detected" and e["area"]["name"] == "Rua Filipe Folque"
    assert make_client().post(f"/api/v1/events/park/{e['id']}/confirm/").status_code == 404
    assert c.post(f"/api/v1/events/park/{e['id']}/confirm/").json()["status"] == "confirmed"
    assert c.post(f"/api/v1/events/park/{e['id']}/dismiss/").status_code == 409
    assert ParkingObservation.objects.count() == 0
    invalidate()


def test_feature_flags_server_governed(seeded, api):
    from apps.core.features import invalidate

    flags = {f["key"]: f for f in api.get("/api/v1/features/").json()["features"]}
    assert flags["parking_sessions"]["enabled"] and flags["pro"]["enabled"] is False
    assert flags["z_trigger"]["phase"] == "experimental"
    FeatureFlag.objects.create(key="pro", enabled=True)
    invalidate()
    flags = {f["key"]: f for f in api.get("/api/v1/features/").json()["features"]}
    assert flags["pro"]["enabled"] is True
    invalidate()


def test_data_quality_command(seeded):
    from django.core.management import call_command

    from apps.core.quality import run_checks

    r = run_checks()
    assert {"checked_at", "issues"} <= set(r)
    assert all(i["severity"] in ("info", "low", "medium", "high") for i in r["issues"])
    call_command("zpot_data_quality", "--json")
