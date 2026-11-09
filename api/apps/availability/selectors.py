from django.utils import timezone

from .models import AvailabilityState, ParkingObservation
from .services import state_of


def availability_for_areas(area_ids, now=None):
    """{area_id: {"status", ...}}. Absent ⇒ unknown. Expired observations are never returned as live."""
    now = now or timezone.now()
    out = {}
    for o in ParkingObservation.objects.filter(area_id__in=area_ids, expires_at__gt=now).order_by(
        "area_id", "-observed_at"
    ):
        if o.area_id in out:
            continue
        st = state_of(o, now)
        if st == AvailabilityState.EXPIRED:
            continue
        out[o.area_id] = {
            "status": st.value,
            "observed_at": o.observed_at.isoformat(),
            "expires_at": o.expires_at.isoformat(),
            "observation_id": o.id,
        }
    return out


def live_observations(now=None):
    now = now or timezone.now()
    return ParkingObservation.objects.filter(expires_at__gt=now)
