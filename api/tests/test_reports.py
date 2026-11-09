import io
from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time
from PIL import Image

from apps.availability.models import ParkingObservation
from apps.community.models import ContributorTrustEvent
from apps.notifications.models import Notification
from apps.parking.models import ParkingArea
from apps.reports.models import CommunityReport, ReportModeration

from .conftest import area_id, guest

pytestmark = pytest.mark.django_db
URL = "/api/v1/reports/"


def loc(ref):
    a = ParkingArea.objects.get(external_ref=f"dev-lisbon-{ref}")
    return {"latitude": a.location.y, "longitude": a.location.x, "area_id": a.id}


def leaving(c, ref="s1", **kw):
    return c.post(
        URL,
        {
            "type": "leaving",
            "details": {"confirm": True},
            **loc(ref),
            "device_latitude": loc(ref)["latitude"],
            "device_longitude": loc(ref)["longitude"],
            **kw,
        },
        format="json",
    )


def test_leaving_report_publishes_short_lived_observation(seeded, make_client):
    c = make_client()
    r = leaving(c)
    assert r.status_code == 201, r.json()
    body = r.json()
    assert body["status"] == "published" and body["reference"].startswith("ZR-")
    assert "reporter" not in body and "trust_explanation" not in body
    obs = ParkingObservation.objects.get(pk=body["observation"]["id"])
    assert obs.expires_at - obs.observed_at == timedelta(minutes=10)
    assert c.get(f"{URL}mine/").json()["results"][0]["id"] == body["id"]
    # the area now shows a recent availability signal in search
    s = c.get(
        "/api/v1/parking/options/",
        {"destination_latitude": 38.7347, "destination_longitude": -9.145, "max_walk_minutes": 30},
    ).json()
    hit = next(x for x in s["results"] if x["id"] == loc("s1")["area_id"])
    assert hit["availability_status"] == "recently_reported_available"


def test_observation_expiry_is_enforced_on_read(seeded, make_client):
    c = make_client()
    rid = leaving(c).json()["id"]
    with freeze_time(timezone.now() + timedelta(minutes=11)):
        near = c.get("/api/v1/availability/nearby/", {"latitude": 38.7351, "longitude": -9.1478}).json()
        assert near["observations"] == []
        d = c.get(f"{URL}{rid}/").json()
        assert d["observation"]["state"] == "observation_expired"
        assert c.post(f"{URL}{rid}/verifications/", {"answer": "still_available"}, format="json").status_code in (
            403,
            410,
        )


def test_guest_can_share_vacancy_but_not_rule_corrections(seeded):
    g = guest()
    assert leaving(g).status_code == 201
    r = g.post(
        URL,
        {
            "type": "incorrect_rule",
            **loc("s1"),
            "details": {"issue": "hours"},
            "description": "Sign says paid until 20:00",
        },
        format="json",
    )
    assert r.status_code == 401
    assert len(g.get(f"{URL}mine/").json()["results"]) == 1
    assert guest("another-install-token-02").get(f"{URL}mine/").json()["results"] == []
    no_token = guest("")
    assert leaving(no_token).status_code == 400


def test_rule_correction_requires_details_and_stays_pending(seeded, make_client):
    c = make_client()
    bad = c.post(URL, {"type": "incorrect_rule", **loc("s2")}, format="json")
    assert bad.status_code == 400 and "details.issue" in bad.json()["error"]["details"]
    ok = c.post(
        URL,
        {
            "type": "incorrect_rule",
            **loc("s2"),
            "details": {"issue": "hours_wrong"},
            "description": "Paid hours now end at 20:00",
        },
        format="json",
    )
    assert ok.status_code == 201 and ok.json()["status"] == "pending_review"
    assert ok.json()["observation"] is None  # never touches canonical rules or live availability


def test_duplicate_detection_and_location_validation(seeded, make_client):
    c = make_client()
    assert leaving(c).status_code == 201
    d = leaving(c)
    assert d.status_code == 409 and d.json()["error"]["code"] == "duplicate_report"
    porto = c.post(URL, {"type": "found", "latitude": 41.15, "longitude": -8.61}, format="json")
    assert porto.status_code == 400 and porto.json()["error"]["code"] == "location_unsupported"
    far = c.post(URL, {"type": "found", "latitude": 38.70, "longitude": -9.17, "area_id": area_id("s1")}, format="json")
    assert far.json()["error"]["code"] == "location_mismatch"
    assert c.post(URL, {"type": "found", "latitude": 123, "longitude": 0}, format="json").status_code == 400
    assert c.post(URL, {"type": "found", **loc("s3"), "details": {"evil": 1}}, format="json").status_code == 400


def test_low_trust_reports_are_not_published(seeded, make_client, settings):
    settings.ZPOT = {**settings.ZPOT, "TRUST_PUBLISH_THRESHOLD": 0.95}
    r = leaving(make_client())
    assert r.json()["status"] == "pending_review" and r.json()["observation"] is None


def test_trust_score_is_explainable(seeded, make_client):
    c = make_client(roles=["data_reviewer"])
    r = leaving(c).json()
    full = c.get(f"{URL}{r['id']}/").json()
    e = full["trust_explanation"]
    assert e["weights"] == {"karma": 0.6, "proximity": 0.2, "recency": 0.2}
    assert e["proximity"] == 1.0 and e["distance_m"] == 0
    assert full["trust_score"] == pytest.approx(0.6 * 0.5 + 0.2 + 0.2, abs=0.01)


def test_verification_confirm_conflict_and_trust_events(seeded, make_client):
    reporter, a, b, c3 = make_client(), make_client(), make_client(), make_client()  # noqa: F841
    rep = leaving(reporter).json()
    rid = rep["id"]
    r = a.post(f"{URL}{rid}/verifications/", {"answer": "still_available"}, format="json").json()
    assert r["state"] == "recently_reported_available" and r["confirmations"] == 2
    assert a.post(f"{URL}{rid}/verifications/", {"answer": "taken"}, format="json").status_code == 409  # one vote
    r2 = b.post(f"{URL}{rid}/verifications/", {"answer": "taken"}, format="json").json()
    assert r2["state"] == "conflicting_reports"
    assert ParkingObservation.objects.get(pk=r2["observation_id"]).needs_review is True
    r3 = c3.post(f"{URL}{rid}/verifications/", {"answer": "taken"}, format="json").json()
    assert r3["state"] == "conflicting_reports"  # 2 taken vs 2 confirmations: still uncertain
    r4 = make_client().post(f"{URL}{rid}/verifications/", {"answer": "taken"}, format="json").json()
    assert r4["state"] == "observation_expired"  # contradictions now outweigh confirmations: removed
    assert CommunityReport.objects.get(pk=rid).status == "superseded"
    assert reporter.post(f"{URL}{rid}/verifications/", {"answer": "taken"}, format="json").status_code in (403, 410)
    reasons = list(ContributorTrustEvent.objects.filter(user=reporter.user).values_list("reason", flat=True))
    assert "confirmed_by_others" in reasons and "contradicted_by_others" in reasons


def test_occupied_report_contradicts_live_vacancy(seeded, make_client):
    leaving(make_client())
    occ = make_client().post(URL, {"type": "occupied", **loc("s1")}, format="json")
    assert occ.status_code == 201
    live = ParkingObservation.objects.filter(kind="leaving").get()
    assert live.contradictions == 1


def test_verify_trd_adapter_delegates(seeded, make_client):
    rep = leaving(make_client()).json()
    r = make_client().post(
        "/api/v1/verify/", {"observation_id": rep["observation"]["id"], "answer": "yes"}, format="json"
    )
    assert r.status_code == 200 and r["Deprecation"] == "true" and r.json()["confirmations"] == 2


def test_availability_create_and_list(seeded, make_client):
    c = make_client()
    r = c.post(
        "/api/v1/availability/observations/",
        {
            "kind": "available",
            **loc("s3"),
            "device_latitude": loc("s3")["latitude"],
            "device_longitude": loc("s3")["longitude"],
        },
        format="json",
    )
    assert r.status_code == 201 and r.json()["state"] == "recently_reported_available"
    lst = c.get("/api/v1/availability/observations/", {"area": area_id("s3")}).json()
    assert len(lst) == 1 and "reporter" not in lst[0]
    near = c.get("/api/v1/availability/nearby/", {"latitude": 38.7328, "longitude": -9.1452}).json()
    assert near["prediction"] == "prediction_unavailable" and near["observations"]
    area_obs = c.get(f"/api/v1/parking/areas/{area_id('s3')}/observations/").json()
    assert area_obs["observations"][0]["state"] == "recently_reported_available"


def test_moderation_flow_notifications_and_appeal(seeded, make_client):
    user, reviewer, plain = make_client(), make_client(roles=["data_reviewer"]), make_client()
    rid = user.post(
        URL, {"type": "new_sign", **loc("s2"), "description": "New loading bay sign 08-10"}, format="json"
    ).json()["id"]
    assert plain.get(URL).status_code == 403
    assert reviewer.get(URL, {"status": "pending_review"}).json()["results"][0]["id"] == rid
    assert plain.patch(f"{URL}{rid}/", {"decision": "accept"}, format="json").status_code == 404
    assert user.patch(f"{URL}{rid}/", {"decision": "accept"}, format="json").status_code == 403
    nr = reviewer.patch(f"{URL}{rid}/", {"decision": "reject"}, format="json")
    assert nr.status_code == 400 and nr.json()["error"]["code"] == "reason_required"
    reviewer.patch(f"{URL}{rid}/", {"decision": "reject", "reason": "No photo of the sign"}, format="json")
    mine = user.get(f"{URL}{rid}/").json()
    assert mine["status"] == "rejected" and mine["rejection_reason"] == "No photo of the sign"
    assert Notification.objects.filter(user=user.user, category="report_update").exists()
    short = user.post(f"{URL}{rid}/appeals/", {"message": "no"}, format="json")
    assert short.status_code == 400
    ap = user.post(f"{URL}{rid}/appeals/", {"message": "The sign is new, photo attached now"}, format="json")
    assert ap.status_code == 201 and ap.json()["status"] == "appeal_review"
    assert user.post(f"{URL}{rid}/appeals/", {"message": "again please review"}, format="json").status_code == 409
    reviewer.patch(f"{URL}{rid}/", {"decision": "accept"}, format="json")
    r = CommunityReport.objects.get(pk=rid)
    assert r.status == "accepted" and r.appeal.status == "upheld"
    assert ReportModeration.objects.filter(report=r).count() == 2
    assert ContributorTrustEvent.objects.filter(user=user.user, reason="appeal_upheld").exists()
    # canonical rules unchanged by an accepted report
    from apps.regulations.models import ParkingRule

    assert ParkingRule.objects.filter(area_id=area_id("s2")).count() == 3


def test_escalate_creates_scout_assignment(seeded, make_client):
    from apps.scouts.models import ScoutAssignment

    user, reviewer = make_client(), make_client(roles=["data_reviewer"])
    rid = user.post(
        URL,
        {
            "type": "incorrect_rule",
            **loc("s5"),
            "details": {"issue": "not_free"},
            "description": "Paid machine installed here",
        },
        format="json",
    ).json()["id"]
    reviewer.patch(f"{URL}{rid}/", {"decision": "escalate_to_scout"}, format="json")
    assert ScoutAssignment.objects.filter(report_id=rid, area_id=area_id("s5")).exists()


def _jpeg(size=(640, 480), with_gps=True):
    img = Image.new("RGB", size, (90, 160, 40))
    buf = io.BytesIO()
    exif = Image.Exif()
    if with_gps:
        exif[0x8825] = {1: "N", 2: (38.0, 44.0, 5.0)}  # GPSInfo
    exif[0x010F] = "PhoneMaker"
    img.save(buf, format="JPEG", exif=exif)
    buf.seek(0)
    buf.name = "sign.jpg"
    return buf


def test_photo_upload_strips_metadata_and_validates(seeded, make_client):
    c = make_client()
    rid = c.post(URL, {"type": "new_sign", **loc("s2"), "description": "New sign at the corner"}, format="json").json()[
        "id"
    ]
    r = c.post(f"{URL}{rid}/attachments/", {"file": _jpeg()}, format="multipart")
    assert r.status_code == 201 and r.json()["metadata_stripped"] is True
    att = CommunityReport.objects.get(pk=rid).attachments.get()
    with att.file.open("rb") as f:
        assert not Image.open(f).getexif()  # EXIF (incl. GPS) removed by re-encoding
    dl = c.get(f"{URL}{rid}/attachments/{att.id}/")
    assert dl.status_code == 200 and dl["Content-Type"] == "image/jpeg"
    other = make_client()
    assert other.get(f"{URL}{rid}/attachments/{att.id}/").status_code == 404
    bad = io.BytesIO(b"%PDF-1.4 not an image")
    bad.name = "x.jpg"
    assert (
        c.post(f"{URL}{rid}/attachments/", {"file": bad}, format="multipart").json()["error"]["code"] == "invalid_image"
    )
    gif = io.BytesIO()
    Image.new("RGB", (10, 10)).save(gif, format="GIF")
    gif.seek(0)
    gif.name = "a.gif"
    assert c.post(f"{URL}{rid}/attachments/", {"file": gif}, format="multipart").status_code == 415


def test_photo_size_limit(seeded, make_client, settings):
    settings.UPLOAD_MAX_BYTES = 1000
    c = make_client()
    rid = c.post(URL, {"type": "new_sign", **loc("s2"), "description": "New sign at the corner"}, format="json").json()[
        "id"
    ]
    assert c.post(f"{URL}{rid}/attachments/", {"file": _jpeg()}, format="multipart").status_code == 413
