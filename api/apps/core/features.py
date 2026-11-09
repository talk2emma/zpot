from django.conf import settings

# Status per feature so the mobile app can route honestly (enabled / disabled / part2).
FEATURE_PHASE = {
    "guest_search": "part1",
    "parking_search": "part1",
    "external_navigation": "part1",
    "community_reports": "part2",
    "parking_sessions": "part2",
    "saved_places_sync": "part2",
    "notifications": "part2",
    "monetisation_concepts": "part2",
    "z_trigger": "experimental",
    "scouts": "part2",
}


def feature_flags():
    flags = settings.ZPOT["FEATURES"]
    return [
        {"key": key, "enabled": bool(enabled), "phase": FEATURE_PHASE.get(key, "part2")}
        for key, enabled in flags.items()
    ]


def is_enabled(key):
    return bool(settings.ZPOT["FEATURES"].get(key))
