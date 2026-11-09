"""Geocoding provider abstraction.

`local` (default) searches the PostGIS development gazetteer — deterministic and offline-safe.
`nominatim` calls OpenStreetMap Nominatim; enable only in compliance with its usage policy
(identifying User-Agent, <= 1 request/second, attribution, no heavy/bulk use).
"""

from dataclasses import dataclass

from django.conf import settings


@dataclass(frozen=True)
class GeoResult:
    id: str
    name: str
    subtitle: str
    latitude: float
    longitude: float
    kind: str
    provider: str


def get_provider():
    name = settings.ZPOT.get("GEOCODER_PROVIDER", "local")
    if name == "nominatim":
        from .nominatim import NominatimProvider

        return NominatimProvider()
    from .local import LocalGazetteerProvider

    return LocalGazetteerProvider()
