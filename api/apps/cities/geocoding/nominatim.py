import json
import time
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache

from . import GeoResult

BASE = "https://nominatim.openstreetmap.org"


class NominatimProvider:
    """Optional OSM Nominatim adapter (cached, rate-limited to 1 req/s across workers)."""

    name = "nominatim"

    def _get(self, path, params):
        key = "nominatim:" + path + ":" + urllib.parse.urlencode(sorted(params.items()))
        hit = cache.get(key)
        if hit is not None:
            return hit
        while not cache.add("nominatim:lock", 1, timeout=1):
            time.sleep(0.2)
        url = f"{BASE}/{path}?{urllib.parse.urlencode({**params, 'format': 'jsonv2'})}"
        req = urllib.request.Request(url, headers={"User-Agent": settings.ZPOT["NOMINATIM_USER_AGENT"]})
        with urllib.request.urlopen(req, timeout=6) as resp:  # noqa: S310
            data = json.loads(resp.read().decode())
        cache.set(key, data, 60 * 60 * 24)
        return data

    @staticmethod
    def _res(d):
        name = d.get("name") or d.get("display_name", "").split(",")[0]
        return GeoResult(
            id=f"osm:{d.get('osm_type')}:{d.get('osm_id')}",
            name=name,
            subtitle=", ".join(d.get("display_name", "").split(", ")[1:3]),
            latitude=float(d["lat"]),
            longitude=float(d["lon"]),
            kind=d.get("type", "address"),
            provider="nominatim",
        )

    def autocomplete(self, q, *, city_slug=None, limit=8, near=None):
        params = {"q": q, "limit": limit, "countrycodes": "pt", "addressdetails": 0}
        if city_slug == "lisbon":
            params.update(viewbox="-9.235,38.80,-9.09,38.69", bounded=1)
        return [self._res(d) for d in self._get("search", params)]

    def geocode(self, q, *, city_slug=None):
        r = self.autocomplete(q, city_slug=city_slug, limit=1)
        return r[0] if r else None

    def reverse(self, lat, lng):
        d = self._get("reverse", {"lat": lat, "lon": lng})
        return (self._res(d), 0.0) if d and "lat" in d else None
