from django.contrib.gis.db.models.functions import Centroid, Distance
from django.contrib.gis.geos import Point

from .models import City, SupportedArea


def city_for_point(lat, lng):
    """Supported or unsupported city whose boundary contains the point (None if outside all)."""
    p = Point(lng, lat, srid=4326)
    return City.objects.filter(boundary__contains=p).order_by("-is_supported").first()


def area_for_point(lat, lng):
    p = Point(lng, lat, srid=4326)
    # neighbourhood boundaries may overlap: prefer the one whose centre is closest
    return (
        SupportedArea.objects.select_related("city")
        .filter(boundary__contains=p)
        .annotate(d=Distance(Centroid("boundary"), p))
        .order_by("d")
        .first()
    )


def coverage_for_point(lat, lng):
    city = city_for_point(lat, lng)
    if city is None:
        return {"status": "unsupported", "city": None, "area": None, "note": "Zpot doesn't cover this location yet."}
    if not city.is_supported:
        return {
            "status": "unsupported",
            "city": city.slug,
            "area": None,
            "note": city.launch_note or f"Zpot isn't available in {city.name} yet.",
        }
    area = area_for_point(lat, lng)
    if area is None:
        return {
            "status": "outside_mapped_areas",
            "city": city.slug,
            "area": None,
            "note": "We have little or no parking data for this part of the city yet.",
        }
    return {
        "status": area.coverage,
        "city": city.slug,
        "area": {"slug": area.slug, "name": area.name},
        "note": area.coverage_note,
    }
