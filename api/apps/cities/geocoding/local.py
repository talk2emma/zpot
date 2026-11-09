from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.postgres.lookups import Unaccent
from django.db.models import Q, Value
from django.db.models.functions import Lower

from apps.cities.models import Place

from . import GeoResult


def _to_result(p):
    return GeoResult(
        id=p.slug,
        name=p.name,
        subtitle=p.subtitle,
        latitude=p.location.y,
        longitude=p.location.x,
        kind=p.kind,
        provider="local",
    )


class LocalGazetteerProvider:
    name = "local"

    def _match(self, q, city_slug=None):
        qs = Place.objects.select_related("city")
        if city_slug:
            qs = qs.filter(city__slug=city_slug)
        q = q.strip()
        needle = Unaccent(Lower(Value(q)))
        return qs.annotate(n=Unaccent(Lower("name")), s=Unaccent(Lower("subtitle"))).filter(
            Q(n__contains=needle) | Q(s__contains=needle)
        )

    def autocomplete(self, q, *, city_slug=None, limit=8, near=None):
        qs = self._match(q, city_slug)
        if near is not None:
            qs = qs.annotate(d=Distance("location", Point(near[1], near[0], srid=4326))).order_by("-is_popular", "d")
        else:
            qs = qs.order_by("-is_popular", "-popularity", "name")
        return [_to_result(p) for p in qs[:limit]]

    def geocode(self, q, *, city_slug=None):
        hits = self.autocomplete(q, city_slug=city_slug, limit=1)
        return hits[0] if hits else None

    def reverse(self, lat, lng):
        point = Point(lng, lat, srid=4326)
        p = Place.objects.annotate(d=Distance("location", point)).order_by("d").first()
        if p is None:
            return None
        return _to_result(p), p.d.m
