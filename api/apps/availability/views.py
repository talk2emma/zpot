from django.contrib.gis.geos import Point, Polygon
from django.contrib.gis.measure import D
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

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


class ObservationListCreateView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ObservationSerializer
    pagination_class = None
    throttle_scope = "reports"

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.request.method == "POST" else super().get_throttles()

    def get_queryset(self):
        qs = live_observations().select_related("area", "report")
        p = self.request.query_params
        if p.get("area"):
            qs = qs.filter(area_id=p["area"])
        if p.get("bbox"):
            x1, y1, x2, y2 = (float(v) for v in p["bbox"].split(","))
            qs = qs.filter(location__intersects=Polygon.from_bbox((x1, y1, x2, y2)))
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
