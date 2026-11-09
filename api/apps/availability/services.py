"""Observation state + trust scoring. Expiry is enforced on every read (not only by the cleanup task)."""

from datetime import timedelta

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from .models import AvailabilityState, ObservationKind


def state_of(obs, now=None):
    now = now or timezone.now()
    if obs.expires_at <= now:
        return AvailabilityState.EXPIRED
    if obs.contradictions >= 2 and obs.contradictions > obs.confirmations:
        return AvailabilityState.EXPIRED  # removed by drivers' answers before its TTL
    if obs.contradictions > 0 and obs.kind != ObservationKind.OCCUPIED:
        return AvailabilityState.CONFLICTING
    if obs.kind == ObservationKind.OCCUPIED:
        return AvailabilityState.RECENTLY_OCCUPIED
    return AvailabilityState.RECENTLY_AVAILABLE


def haversine_m(lat1, lng1, lat2, lng2):
    import math

    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def ttl_minutes(kind):
    return settings.ZPOT["OBSERVATION_TTL_MINUTES"][kind]


def karma(user):
    if user is None:
        return settings.ZPOT["TRUST_DEFAULT_KARMA"] * 0.6  # guests start lower
    from apps.community.models import ContributorTrustEvent

    total = ContributorTrustEvent.objects.filter(user=user).aggregate(s=Sum("delta"))["s"] or 0
    return max(0.0, min(1.0, settings.ZPOT["TRUST_DEFAULT_KARMA"] + total))


def trust_score(*, user, report_point, device_point=None, observed_at=None, now=None):
    """Explainable, configurable score (TRD hypothesis: karma×0.6 + proximity×0.2 + recency×0.2).

    Proximity is only counted when the device supplied a location (it is never stored).
    """
    now = now or timezone.now()
    w = settings.ZPOT["TRUST_WEIGHTS"]
    k = karma(user)
    prox, dist = 0.0, None
    if device_point is not None:
        dist = haversine_m(device_point.y, device_point.x, report_point.y, report_point.x)
        prox = 1.0 if dist <= 50 else 0.0 if dist >= 500 else 1 - (dist - 50) / 450
    age = ((now - observed_at).total_seconds() / 60) if observed_at else 0
    rec = max(0.0, 1 - age / 10)
    score = w["karma"] * k + w["proximity"] * prox + w["recency"] * rec
    return round(score, 3), {
        "weights": w,
        "karma": round(k, 3),
        "proximity": round(prox, 3),
        "distance_m": round(dist) if dist is not None else None,
        "recency": round(rec, 3),
        "threshold": settings.ZPOT["TRUST_PUBLISH_THRESHOLD"],
        "note": "Provisional model; never overrides verified legal restrictions.",
    }


def extend_on_confirm(obs, now=None):
    now = now or timezone.now()
    obs.expires_at = max(obs.expires_at, now) + timedelta(
        minutes=settings.ZPOT["OBSERVATION_CONFIRM_EXTENSION_MINUTES"]
    )
