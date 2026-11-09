from dataclasses import asdict

from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import ZpotAPIError

from .geocoding import get_provider
from .models import City
from .selectors import coverage_for_point
from .serializers import (
    AutocompleteQuerySerializer,
    CitySerializer,
    GeocodeQuerySerializer,
    PlaceResultSerializer,
    ReverseQuerySerializer,
    SupportedAreaSerializer,
)


class CityListView(ListAPIView):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class CityDetailView(RetrieveAPIView):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [AllowAny]


class CityCoverageView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=SupportedAreaSerializer(many=True))
    def get(self, request, pk):
        city = City.objects.filter(pk=pk).first()
        if city is None:
            raise ZpotAPIError("City not found.", code="not_found", status_code=404)
        return Response(
            {"city": CitySerializer(city).data, "areas": SupportedAreaSerializer(city.areas.all(), many=True).data}
        )


def _with_coverage(res):
    d = asdict(res)
    d["coverage"] = coverage_for_point(res.latitude, res.longitude)
    return d


class AutocompleteView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(parameters=[AutocompleteQuerySerializer], responses=PlaceResultSerializer(many=True))
    def get(self, request):
        s = AutocompleteQuerySerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        near = (d["latitude"], d["longitude"]) if "latitude" in d and "longitude" in d else None
        results = get_provider().autocomplete(d["q"], city_slug=None, limit=d["limit"], near=near)
        return Response({"results": [_with_coverage(r) for r in results]})


class GeocodeView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(parameters=[GeocodeQuerySerializer], responses=PlaceResultSerializer)
    def get(self, request):
        s = GeocodeQuerySerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        res = get_provider().geocode(s.validated_data["q"])
        if res is None:
            raise ZpotAPIError("No matching place found.", code="place_not_found", status_code=404)
        return Response(_with_coverage(res))


class ReverseGeocodeView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(parameters=[ReverseQuerySerializer], responses=PlaceResultSerializer)
    def get(self, request):
        s = ReverseQuerySerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        lat, lng = s.validated_data["latitude"], s.validated_data["longitude"]
        hit = get_provider().reverse(lat, lng)
        coverage = coverage_for_point(lat, lng)
        if hit is None:
            return Response({"nearest_place": None, "distance_meters": None, "coverage": coverage})
        res, dist = hit
        return Response({"nearest_place": asdict(res), "distance_meters": round(dist), "coverage": coverage})
