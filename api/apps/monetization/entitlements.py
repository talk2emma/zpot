"""Plan entitlements. There is no billing provider in this build, so every user is on the Free plan.

Nothing here can grant Pro: Pro requires a verified App Store / Google Play receipt, which is not implemented.
Limits below are the Free tier described in the prototype (one vehicle, one commute day, no CSV export).
"""

from apps.core.features import is_enabled

FREE_LIMITS = {"vehicles": 1, "commute_days_visible": 1, "insights_export": False, "ad_free": False}


def entitlement_for(user) -> dict:
    return {
        "plan": "free",
        "status": "none",
        "provider": None,
        "purchases_available": False,
        "pro_preview_enabled": is_enabled("pro"),
        "limits": dict(FREE_LIMITS),
        "note": "Purchases are not available in this build. No payment can be taken and nothing is unlocked.",
    }


def limit(user, key):
    return entitlement_for(user)["limits"][key]
