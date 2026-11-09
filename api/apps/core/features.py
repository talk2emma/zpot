from django.conf import settings
from django.core.cache import cache

# Status per feature so the mobile app can route honestly.
FEATURE_PHASE = {
    "guest_search": "mvp",
    "parking_search": "mvp",
    "external_navigation": "mvp",
    "community_reports": "mvp",
    "parking_sessions": "mvp",
    "saved_places_sync": "mvp",
    "notifications": "mvp",
    "support": "mvp",
    "privacy_requests": "mvp",
    "scouts": "mvp",
    "monetisation_concepts": "post-mvp",
    "pro": "post-mvp",
    "partners": "post-mvp",
    "advertising": "post-mvp",
    "z_trigger": "experimental",
}
_CACHE_KEY = "zpot:feature-flags"


def _flags():
    flags = dict(settings.ZPOT["FEATURES"])
    cached = cache.get(_CACHE_KEY)
    if cached is None:
        from .models import FeatureFlag

        try:
            cached = {f.key: f.enabled for f in FeatureFlag.objects.all()}
        except Exception:  # noqa: BLE001 - table may not exist during migrate
            cached = {}
        cache.set(_CACHE_KEY, cached, 30)
    flags.update(cached)
    return flags


def invalidate():
    cache.delete(_CACHE_KEY)


def feature_flags():
    return [{"key": k, "enabled": bool(v), "phase": FEATURE_PHASE.get(k, "mvp")} for k, v in _flags().items()]


def is_enabled(key):
    return bool(_flags().get(key))
