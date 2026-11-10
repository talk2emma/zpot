from django.contrib.gis.geos import Point, Polygon
from django.contrib.gis.measure import D
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.features import FeatureGateMixin
from apps.core.permissions import client_token
from apps.reports import services as report_services

from .models import AvailabilityState, ParkingObservation
from .selectors import live_observations
from .serializers import (
    CreateObservationSerializer,
    NearbyQuerySerializer,
    ObservationSerializer,
    VerifyCompatSerializer,
)
from .services import state_of

KIND_TO_REPORT = {"available": "found", "leaving": "leaving", "occupied": "occupied"}


def _live(qs):
    now = timezone.now()
    return [o for o in qs if state_of(o, now) != AvailabilityState.EXPIRED]


class NearbyAvailabilityView(GenericAPIView):
    permission_classes = [AllowAny]
    queryset = ParkingObservation.objects.none()
    serializer_class = ObservationSerializer

    @extend_schema(parameters=[NearbyQuerySerializer], responses=ObservationSerializer(many=True))
    def get(self, request):
        q = NearbyQuerySerializer(data=request.query_params)
        q.is_valid(raise_exception=True)
        d = q.validated_data
        p = Point(d["longitude"], d["latitude"], srid=4326)
        qs = live_observations().filter(location__dwithin=(p, D(m=d["radius_meters"]))).select_related("area", "report")
        return Response(
            {
                "observations": self.get_serializer(_live(qs), many=True).data,
                "note": "Reports are short-lived signals. A reported space may already be taken.",
                "prediction": AvailabilityState.PREDICTION_UNAVAILABLE.value,
            }
        )


class ObservationFilterSerializer(serializers.Serializer):
    area = serializers.IntegerField(required=False, min_value=1)
    bbox = serializers.CharField(required=False, help_text="min_lon,min_lat,max_lon,max_lat (WGS84)")

    def validate_bbox(self, value):
        try:
            parts = [float(x) for x in value.split(",")]
        except ValueError as exc:
            raise serializers.ValidationError("bbox must be four numbers.") from exc
        if len(parts) != 4:
            raise serializers.ValidationError("bbox must be four numbers.")
        x1, y1, x2, y2 = parts
        if not (-180 <= x1 < x2 <= 180 and -90 <= y1 < y2 <= 90) or (x2 - x1) > 0.2 or (y2 - y1) > 0.2:
            raise serializers.ValidationError("bbox is not a valid extent (max 0.2° per side).")
        return (x1, y1, x2, y2)


class ObservationListCreateView(FeatureGateMixin, ListAPIView):
    feature_flag = "community_reports"
    permission_classes = [AllowAny]
    serializer_class = ObservationSerializer
    pagination_class = None
    throttle_scope = "reports"

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.request.method == "POST" else super().get_throttles()

    def get_queryset(self):
        qs = live_observations().select_related("area", "report")
        if getattr(self, "swagger_fake_view", False) or self.request.method != "GET":
            return qs
        f = ObservationFilterSerializer(data=self.request.query_params)
        f.is_valid(raise_exception=True)
        d = f.validated_data
        if d.get("area"):
            qs = qs.filter(area_id=d["area"])
        if d.get("bbox"):
            qs = qs.filter(location__intersects=Polygon.from_bbox(d["bbox"]))
        return qs

    def list(self, request, *args, **kwargs):
        return Response(self.get_serializer(_live(self.get_queryset()[:300]), many=True).data)

    @extend_schema(request=CreateObservationSerializer, responses={201: ObservationSerializer})
    def post(self, request):
        s = CreateObservationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        kind = d.pop("kind")
        details = {"confirm": True} if kind == "leaving" else {}
        r = report_services.create_report(
            user=request.user, client_token=client_token(request), type=KIND_TO_REPORT[kind], details=details, **d
        )
        if r.observation is None:
            return Response(
                {
                    "report_id": str(r.id),
                    "status": r.status,
                    "detail": "Received; it will be shown once confirmed (low trust score).",
                },
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(ObservationSerializer(r.observation).data, status=status.HTTP_201_CREATED)


class VerifyCompatView(GenericAPIView):
    """TRD compatibility (`POST /verify`). Delegates to the canonical verification service."""

    permission_classes = [AllowAny]
    serializer_class = VerifyCompatSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verifications"

    @extend_schema(deprecated=True, responses=ObservationSerializer)
    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        ans = {"yes": "still_available", "no": "taken"}.get(s.validated_data["answer"], s.validated_data["answer"])
        obs, st = report_services.verify_observation(
            observation_id=s.validated_data["observation_id"],
            answer=ans,
            user=request.user,
            client_token=client_token(request),
        )
        resp = Response({**ObservationSerializer(obs).data, "state": st.value})
        resp["Deprecation"] = "true"
        resp["Link"] = '</api/v1/reports/{id}/verifications/>; rel="successor-version"'
        return resp
