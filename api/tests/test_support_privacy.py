import io
import json

import pytest
from PIL import Image

from apps.accounts.models import ConsentRecord, User
from apps.privacy.models import DataPrivacyRequest
from apps.reports.models import CommunityReport
from apps.support.models import SupportTicket

from .conftest import area_id

pytestmark = pytest.mark.django_db


def test_help_articles_bilingual(seeded, api):
    lst = api.get("/api/v1/help/articles/").json()
    assert len(lst) >= 7 and lst[0]["title"]
    pt = api.get(f"/api/v1/help/articles/{lst[0]['id']}/", {"lang": "pt-PT"}).json()
    assert pt["title"] != lst[0]["title"]
    assert api.get("/api/v1/help/articles/", {"category": "privacy"}).json()[0]["slug"] == "location"


def test_support_ticket_flow(seeded, make_client, api):
    c = make_client()
    short = c.post("/api/v1/support/tickets/", {"category": "account", "description": "help"}, format="json")
    assert short.status_code == 400
    r = c.post(
        "/api/v1/support/tickets/",
        {
            "category": "wrong_rule",
            "description": "The paid hours shown are wrong here",
            "include_context": True,
            "context": {"area_id": 1, "secret": "x"},
        },
        format="json",
    )
    assert r.status_code == 201 and r.json()["reference"].startswith("ZS-")
    t = SupportTicket.objects.get(pk=r.json()["id"])
    assert t.priority == "high" and t.context == {"area_id": 1}  # unknown context keys dropped
    assert c.get("/api/v1/support/tickets/").json()["results"][0]["id"] == r.json()["id"]
    assert make_client().get(f"/api/v1/support/tickets/{t.id}/").status_code == 404
    g = api.post(
        "/api/v1/support/tickets/", {"category": "other", "description": "Guest question about the map"}, format="json"
    )
    assert g.status_code == 400 and "contact_email" in g.json()["error"]["details"]
    g2 = api.post(
        "/api/v1/support/tickets/",
        {"category": "other", "description": "Guest question about the map", "contact_email": "g@example.pt"},
        format="json",
    )
    assert g2.status_code == 201
    img = io.BytesIO()
    Image.new("RGB", (20, 20)).save(img, format="PNG")
    img.seek(0)
    img.name = "s.png"
    assert c.post(f"/api/v1/support/tickets/{t.id}/attachments/", {"file": img}, format="multipart").status_code == 201


def test_consents_read_update_and_ledger(seeded, make_client):
    c = make_client()
    cur = c.get("/api/v1/privacy/consents/").json()
    assert cur["terms"]["granted"] is True and cur["analytics"]["granted"] is False
    up = c.patch("/api/v1/privacy/consents/", {"analytics": True}, format="json").json()
    assert up["analytics"]["granted"] is True
    assert c.get("/api/v1/users/me/preferences/").json()["analytics_opt_in"] is True
    assert ConsentRecord.objects.filter(user=c.user, consent_type="analytics").count() == 1
    bad = c.patch("/api/v1/privacy/consents/", {"terms": False}, format="json")
    assert bad.json()["error"]["code"] == "use_deletion_request"
    assert c.patch("/api/v1/privacy/consents/", {"analytics": "yes"}, format="json").status_code == 400


def test_data_export_is_generated_private_and_downloadable(seeded, make_client, django_capture_on_commit_callbacks):
    c = make_client()
    c.post("/api/v1/saved/locations/", {"area_id": area_id("s1")}, format="json")
    with django_capture_on_commit_callbacks(execute=True):
        r = c.post("/api/v1/privacy/data-export/")
    assert r.status_code == 202
    req = c.get("/api/v1/privacy/requests/").json()[0]
    assert req["status"] == "completed" and req["download_available"] is True  # eager Celery in tests
    dl = c.get(f"/api/v1/privacy/requests/{req['id']}/download/")
    data = json.loads(b"".join(dl.streaming_content))
    assert data["account"]["email"] == c.user.email and data["saved_locations"][0]["area"] == "Rua Filipe Folque"
    assert make_client().get(f"/api/v1/privacy/requests/{req['id']}/download/").status_code == 404
    from apps.notifications.models import Notification

    assert Notification.objects.filter(user=c.user, category="privacy").exists()


def test_deletion_request_erases_account_and_anonymises_reports(seeded, make_client):
    c = make_client()
    a = __import__("apps.parking.models", fromlist=["ParkingArea"]).ParkingArea.objects.get(
        external_ref="dev-lisbon-s2"
    )
    c.post(
        "/api/v1/reports/",
        {
            "type": "new_sign",
            "latitude": a.location.y,
            "longitude": a.location.x,
            "description": "A new loading bay sign",
        },
        format="json",
    )
    email = c.user.email
    assert c.post("/api/v1/privacy/deletion-request/", {"confirm": "nope"}, format="json").status_code == 400
    r = c.post("/api/v1/privacy/deletion-request/", {"confirm": "DELETE"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "completed"
    assert not User.objects.filter(email=email).exists()
    rep = CommunityReport.objects.get(type="new_sign")
    assert rep.reporter is None and rep.description == ""
    assert DataPrivacyRequest.objects.get(user_email=email, kind="deletion").user is None
    assert c.get("/api/v1/users/me/").status_code == 401


def test_retention_cleanup(seeded, make_client, django_capture_on_commit_callbacks):
    from datetime import timedelta

    from django.utils import timezone

    from apps.privacy.services import retention_cleanup

    c = make_client()
    with django_capture_on_commit_callbacks(execute=True):
        c.post("/api/v1/privacy/data-export/")
    r = DataPrivacyRequest.objects.get(user=c.user)
    r.expires_at = timezone.now() - timedelta(days=1)
    r.save()
    out = retention_cleanup()
    r.refresh_from_db()
    assert out["exports_expired"] == 1 and r.status == "expired" and not r.file
