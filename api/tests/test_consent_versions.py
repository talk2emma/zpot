"""GDPR accountability: every consent record states which document version and which screen it came from."""

import pytest
from django.test import override_settings

from apps.accounts.models import ConsentRecord

pytestmark = pytest.mark.django_db
VERSIONS = {"privacy": "2026-11-10-draft", "terms": "2026-11-10-draft"}


def test_config_publishes_current_legal_versions(api):
    legal = api.get("/api/v1/config/").json()["legal"]
    assert legal == {"privacy_version": VERSIONS["privacy"], "terms_version": VERSIONS["terms"]}


def test_registration_records_versions_and_source(api):
    r = api.post(
        "/api/v1/auth/register/",
        {"email": "v@zpot.test", "password": "Str0ng-pass-123", "accept_terms": True},
        format="json",
    )
    assert r.status_code == 201
    recs = {c.consent_type: c for c in ConsentRecord.objects.filter(user__email="v@zpot.test")}
    assert set(recs) == {"terms", "privacy"}
    assert all(
        c.source == "registration" and c.document_version == VERSIONS["privacy"] and c.granted for c in recs.values()
    )


def test_consent_prompt_choices_are_recorded_with_version_and_source(make_client):
    c = make_client()
    r = c.patch(
        "/api/v1/privacy/consents/",
        {"analytics": False, "personalised_ads": False, "marketing": True, "source": "consent_prompt"},
        format="json",
    )
    assert r.status_code == 200
    body = r.json()
    assert body["analytics"]["granted"] is False and body["marketing"]["granted"] is True
    assert body["marketing"]["document_version"] == VERSIONS["privacy"]
    rec = ConsentRecord.objects.filter(user=c.user, consent_type="marketing").first()
    assert rec.source == "consent_prompt"
    assert (
        c.patch("/api/v1/privacy/consents/", {"analytics": True, "source": "website"}, format="json").status_code == 400
    )


@override_settings(
    ZPOT={**__import__("django.conf").conf.settings.ZPOT, "LEGAL_VERSIONS": {"privacy": "v2", "terms": "v2"}}
)
def test_bumping_the_policy_version_changes_what_is_recorded(make_client):
    c = make_client()
    c.patch("/api/v1/privacy/consents/", {"analytics": True}, format="json")
    assert ConsentRecord.objects.filter(user=c.user, consent_type="analytics").first().document_version == "v2"
