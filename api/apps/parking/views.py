from django.conf import settings
from django.contrib.gis.geos import Polygon
from django.utils import timezone
from django_filters import rest_framework as filters
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.availability.models import ParkingObservation
from apps.availability.serializers import ObservationSerializer
from apps.core.exceptions import ZpotAPIError
from apps.regulations.serializers import (
    ParkingRestrictionSerializer,
    ParkingRuleSerializer,
    TemporaryClosureSerializer,
)
from apps.regulations.services.describe import restriction_line, rule_line, validity_suffix

from .models import ParkingArea
from .openapi import (
    AreaEvidenceResponseSerializer,
    AreaRulesResponseSerializer,
    CompareResponseSerializer,
    MapLayersResponseSerializer,
    ObservationsResponseSerializer,
    ParkingAreaDetailDocSerializer,
    ParkingOptionsResponseSerializer,
    SpotsNearbyResponseSerializer,
)
from .selectors import areas_with_regulations
from .serializers import (
    AreaDetailQuerySerializer,
    CompareQuerySerializer,
    EvidenceSerializer,
    MapLayersQuerySerializer,
    ParkingAreaListSerializer,
    ParkingOptionSerializer,
    SearchQuerySerializer,
    area_geometry,
    driver_from_params,
    parse_arrival,
)
from .services.search import SearchParams, encode_cursor, evaluate_candidates, search_parking

LAYER_FOR_CATEGORY = {
    "free": "free",
    "free_time_limited": "timed",
    "paid": "paid",
    "restricted": "restrict",
    "unknown": "unknown",
}


def _search_params(d):
    lat = d.get("destination_latitude", d.get("latitude"))
    lng = d.get("destination_longitude", d.get("longitude"))
    origin = (d["latitude"], d["longitude"]) if "latitude" in d and "destination_latitude" in d else None
    return SearchParams(
        latitude=lat,
        longitude=lng,
        origin=origin,
        arrival_at=parse_arrival(d.get("arrival_at"), "Europe/Lisbon"),
        duration_minutes=d["duration_minutes"],
        radius_meters=d["radius_meters"],
        max_walk_minutes=d["max_walk_minutes"],
        driver=driver_from_params(d),
        max_price=d.get("max_price"),
        free_only=d["free_only"],
        include_paid=d["include_paid"],
        include_unknown=not d["verified_only"],
        include_restricted=d["include_restricted"],
        accessible_only=d["accessible_only"],
        limit=d["limit"],
        offset=d.get("offset", 0),
    )


class ParkingOptionsView(APIView):
    """Ranked, free-first parking options for a destination and planned stay."""

    permission_classes = [AllowAny]

    @extend_schema(parameters=[SearchQuerySerializer], responses=ParkingOptionsResponseSerializer)
    def get(self, request):
        s = SearchQuerySerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        params = _search_params(s.validated_data)
        result = search_parking(params)
        return Response(
            {
                "query": {
                    "latitude": params.latitude,
                    "longitude": params.longitude,
                    "arrival_at": params.arrival_at.isoformat(),
                    "duration_minutes": params.duration_minutes,
                    "radius_meters": params.radius_meters,
                    "max_walk_minutes": params.max_walk_minutes,
                    "free_only": params.free_only,
                    "include_paid": params.include_paid,
                    "verified_only": not params.include_unknown,
                    "vehicle_class": params.driver.vehicle_class,
                },
                "coverage": result.coverage,
                "summary": result.summary,
                "recommended_id": result.recommended.area.id if result.recommended else None,
                "count": result.total,
                "next_cursor": encode_cursor(result.next_offset) if result.next_offset is not None else None,
                "results": ParkingOptionSerializer(result.options, many=True).data,
                "disclaimer": "Check street signs before parking. Signs on the street take priority over Zpot.",
            }
        )


class SpotsNearbyCompatView(APIView):
    """TRD compatibility adapter (`/spots/nearby`). Delegates to the canonical search service —
    results follow Zpot's free-first ranking, not raw distance. Prefer /parking/options/."""

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter("lat", float),
            OpenApiParameter("lng", float),
            OpenApiParameter("radius", int, required=False),
        ],
        deprecated=True,
        responses=SpotsNearbyResponseSerializer,
    )
    def get(self, request):
        q = request.query_params
        data = {
            "latitude": q.get("lat", q.get("latitude")),
            "longitude": q.get("lng", q.get("longitude")),
            "radius_meters": q.get("radius", settings.ZPOT["SEARCH_DEFAULTS"]["radius_meters"]),
            "max_walk_minutes": 30,
            "limit": 5,
        }
        s = SearchQuerySerializer(data={k: v for k, v in data.items() if v is not None})
        s.is_valid(raise_exception=True)
        result = search_parking(_search_params(s.validated_data))
        spots = []
        for o in result.options:
            ev = o.evaluation
            spots.append(
                {
                    "id": o.area.id,
                    "name": o.area.name,
                    "lat": o.area.location.y,
                    "lng": o.area.location.x,
                    "distance_m": round(o.distance_meters),
                    "walk_minutes": o.walking_duration_minutes,
                    "status": ev.category.value,
                    "is_free": ev.category.value in ("free", "free_time_limited"),
                    "expected_total_cost": str(ev.expected_total_cost) if ev.expected_total_cost is not None else None,
                    "verified_at": o.area.verified_at,
                }
            )
        resp = Response(
            {
                "spots": spots,
                "ranking": "free_first",
                "canonical_endpoint": "/api/v1/parking/options/",
                "coverage": result.coverage,
            }
        )
        resp["Deprecation"] = "true"
        resp["Link"] = '</api/v1/parking/options/>; rel="successor-version"'
        return resp


class AreaFilter(filters.FilterSet):
    city = filters.CharFilter(field_name="city__slug")
    supported_area = filters.CharFilter(field_name="supported_area__slug")
    kind = filters.CharFilter(field_name="kind")
    verification_status = filters.CharFilter(field_name="verification_status")
    bbox = filters.CharFilter(method="filter_bbox", help_text="min_lon,min_lat,max_lon,max_lat")

    class Meta:
        model = ParkingArea
        fields = ["city", "supported_area", "kind", "verification_status"]

    def filter_bbox(self, qs, name, value):
        try:
            x1, y1, x2, y2 = (float(v) for v in value.split(","))
        except ValueError as exc:
            raise ZpotAPIError("bbox must be four numbers.", code="validation_error") from exc
        return qs.filter(location__intersects=Polygon.from_bbox((x1, y1, x2, y2)))


class ParkingAreaListView(ListAPIView):
    queryset = ParkingArea.objects.filter(is_active=True).select_related("data_source").order_by("id")
    serializer_class = ParkingAreaListSerializer
    permission_classes = [AllowAny]
    filterset_class = AreaFilter


def _get_area(pk):
    area = areas_with_regulations().filter(pk=pk, is_active=True).first()
    if area is None:
        raise ZpotAPIError("Parking area not found.", code="not_found", status_code=404)
    return area


def _single_option(area, d, lat=None, lng=None):
    from django.contrib.gis.geos import Point

    params = SearchParams(
        latitude=area.location.y,
        longitude=area.location.x,
        arrival_at=parse_arrival(d.get("arrival_at"), area.city.timezone),
        duration_minutes=d["duration_minutes"],
        radius_meters=0,
        max_walk_minutes=30,
        driver=driver_from_params(d),
    )
    dist = 0.0
    if lat is not None and lng is not None:
        from django.contrib.gis.db.models.functions import Distance

        dist = (
            ParkingArea.objects.filter(pk=area.pk)
            .annotate(d=Distance("location", Point(float(lng), float(lat), srid=4326)))
            .first()
            .d.m
        )
    return evaluate_candidates([area], params, {area.id: dist})[0]


def _rule_lines(area):
    lines = [c.reason for c in area.closures.all() if c.ends_at > timezone.now()]
    lines += [rule_line(r) + validity_suffix(r) for r in area.rules.all()]
    lines += [restriction_line(r) + validity_suffix(r) for r in area.restrictions.all()]
    if area.verification_status == "unverified":
        lines.append("We have no confirmed rule for this street. Read the signs before you park.")
    return lines


class ParkingAreaDetailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            AreaDetailQuerySerializer,
        ],
        responses=ParkingAreaDetailDocSerializer,
    )
    def get(self, request, pk):
        area = _get_area(pk)
        s = AreaDetailQuerySerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        option = _single_option(area, d, d.get("latitude"), d.get("longitude"))
        data = ParkingOptionSerializer(option).data
        data.update(
            {
                "supported_area": {
                    "slug": area.supported_area.slug,
                    "name": area.supported_area.name,
                    "coverage": area.supported_area.coverage,
                    "coverage_note": area.supported_area.coverage_note,
                }
                if area.supported_area
                else None,
                "operator_name": area.operator_name or None,
                "capacity_estimate": area.capacity_estimate,
                "rule_lines": _rule_lines(area),
                "evidence_count": area.evidence.count(),
                "disclaimer": "Check street signs before parking. Signs on the street take priority over Zpot.",
            }
        )
        return Response(data)


class ParkingAreaRulesView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=AreaRulesResponseSerializer)
    def get(self, request, pk):
        area = _get_area(pk)
        upcoming = [c for c in area.closures.all() if c.ends_at > timezone.now()]
        return Response(
            {
                "area_id": area.id,
                "verification_status": area.verification_status,
                "rules": ParkingRuleSerializer(area.rules.all(), many=True).data,
                "restrictions": ParkingRestrictionSerializer(area.restrictions.all(), many=True).data,
                "closures": TemporaryClosureSerializer(upcoming, many=True).data,
                "rule_lines": _rule_lines(area),
            }
        )


class ParkingAreaEvidenceView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=AreaEvidenceResponseSerializer)
    def get(self, request, pk):
        area = _get_area(pk)
        return Response(
            {
                "area_id": area.id,
                "evidence_status": area.evidence_status,
                "verification_status": area.verification_status,
                "verified_at": area.verified_at,
                "evidence": EvidenceSerializer(area.evidence.select_related("source"), many=True).data,
            }
        )


class ParkingAreaObservationsView(APIView):
    """Active (unexpired) availability observations. Read-only in Part 1; reporting writes arrive in Part 2."""

    permission_classes = [AllowAny]

    @extend_schema(responses=ObservationsResponseSerializer)
    def get(self, request, pk):
        area = _get_area(pk)
        from apps.availability.views import _live

        qs = _live(
            ParkingObservation.objects.filter(area=area, expires_at__gt=timezone.now())
            .select_related("area", "report")
            .order_by("-observed_at")
        )
        return Response(
            {
                "area_id": area.id,
                "observations": ObservationSerializer(qs, many=True).data,
                "note": "Observations expire quickly and never prove a space is free.",
            }
        )


class MapLayersView(APIView):
    """GeoJSON overlays for every parking area in a bounding box, classified for the planned stay."""

    permission_classes = [AllowAny]

    @extend_schema(parameters=[MapLayersQuerySerializer], responses=MapLayersResponseSerializer)
    def get(self, request):
        s = MapLayersQuerySerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        x1, y1, x2, y2 = d["bbox"]
        areas = list(
            areas_with_regulations().filter(is_active=True, location__intersects=Polygon.from_bbox((x1, y1, x2, y2)))[
                :500
            ]
        )
        params = SearchParams(
            latitude=(y1 + y2) / 2,
            longitude=(x1 + x2) / 2,
            arrival_at=parse_arrival(d.get("arrival_at"), "Europe/Lisbon"),
            duration_minutes=d["duration_minutes"],
            radius_meters=0,
            max_walk_minutes=30,
            driver=driver_from_params(d),
        )
        features = []
        for o in evaluate_candidates(areas, params, {a.id: 0.0 for a in areas}):
            ev, a = o.evaluation, o.area
            features.append(
                {
                    "type": "Feature",
                    "id": a.id,
                    "geometry": area_geometry(a),
                    "properties": {
                        "id": a.id,
                        "name": a.name,
                        "category": ev.category.value,
                        "layer": LAYER_FOR_CATEGORY[ev.category.value],
                        "kind": a.kind,
                        "rate_per_hour": _rate(a),
                        "leave_by": ev.leave_by.isoformat() if ev.leave_by else None,
                        "latitude": a.location.y,
                        "longitude": a.location.x,
                        "availability_status": o.availability.get("status", "unknown"),
                    },
                }
            )
        return Response({"type": "FeatureCollection", "features": features})


def _rate(area):
    rates = [r.tariff.rate_per_hour for r in area.rules.all() if r.kind == "paid" and r.tariff_id]
    return str(min(rates)) if rates else None


class CompareView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(parameters=[CompareQuerySerializer], responses=CompareResponseSerializer)
    def get(self, request):
        s = CompareQuerySerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        areas = {a.id: a for a in areas_with_regulations().filter(pk__in=d["ids"], is_active=True)}
        missing = [i for i in d["ids"] if i not in areas]
        if missing:
            raise ZpotAPIError(
                "Some parking areas were not found.",
                code="not_found",
                status_code=404,
                details={"missing_ids": missing},
            )
        opts = [_single_option(areas[i], d, d.get("latitude"), d.get("longitude")) for i in d["ids"]]
        from .services.search import ranking_key

        ordered = sorted(opts, key=ranking_key)
        return Response(
            {
                "results": ParkingOptionSerializer(ordered, many=True).data,
                "best_id": ordered[0].area.id if ordered else None,
            }
        )
