"""Current legal document versions (settings.ZPOT["LEGAL_VERSIONS"]) for the consent ledger."""

from django.conf import settings

CONSENT_SOURCES = ("registration", "consent_prompt", "privacy_settings", "preferences")


def legal_versions() -> dict:
    v = settings.ZPOT["LEGAL_VERSIONS"]
    return {"privacy_version": v["privacy"], "terms_version": v["terms"]}


def version_for(consent_type: str) -> str:
    """Terms consent refers to the terms; every other consent is given against the privacy policy."""
    v = settings.ZPOT["LEGAL_VERSIONS"]
    return v["terms"] if consent_type == "terms" else v["privacy"]
