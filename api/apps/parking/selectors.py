from apps.regulations.services.specs import REGULATION_PREFETCH

from .models import ParkingArea


def areas_with_regulations():
    return ParkingArea.objects.select_related("city", "data_source", "supported_area").prefetch_related(
        *REGULATION_PREFETCH
    )
