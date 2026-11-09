from django.utils import timezone

from .models import ObservationKind, ParkingObservation


def availability_for_areas(area_ids, now=None):
    """{area_id: {"status", "observed_at", "expires_at"}}. Default (absent) is status=unknown."""
    now = now or timezone.now()
    out = {}
    for o in ParkingObservation.objects.filter(area_id__in=area_ids, expires_at__gt=now).order_by(
        "area_id", "-observed_at"
    ):
        if o.area_id in out:
            continue
        if o.contradictions and o.contradictions >= o.confirmations:
            status = "conflicting_reports"
        elif o.kind == ObservationKind.OCCUPIED:
            status = "reported_occupied"
        else:
            status = "recently_reported_available"
        out[o.area_id] = {
            "status": status,
            "observed_at": o.observed_at.isoformat(),
            "expires_at": o.expires_at.isoformat(),
        }
    return out
