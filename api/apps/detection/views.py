from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import ZpotAPIError
from apps.core.features import is_enabled
from apps.parking.models import ParkingArea

from .models import ParkEventStatus, ParkingEvent


class ParkEventSerializer(serializers.ModelSerializer):
    location = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()

    class Meta:
        model = ParkingEvent
        fields = ["id", "source", "location", "accuracy_m", "detected_at", "status", "area", "session"]

    def get_location(self, o) -> dict:
        return {"latitude": o.location.y, "longitude": o.location.x}

    def get_area(self, o) -> dict | None:
        return {"id": o.area_id, "name": o.area.name} if o.area_id else None


class CreateEventSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    accuracy_m = serializers.FloatField(required=False, min_value=0, max_value=5000)
    detected_at = serializers.DateTimeField()
    source = serializers.ChoiceField(
        choices=["bluetooth_disconnect", "motion", "manual_test"], default="bluetooth_disconnect"
    )


def _guard():
    if not is_enabled("z_trigger"):
        raise ZpotAPIError(
            "Z-Trigger is an experimental feature and is disabled.", code="feature_disabled", status_code=403
        )


class DetectionConfigView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = None

    @extend_schema(
        responses=inline_serializer(
            "DetectionConfig",
            {
                "enabled": serializers.BooleanField(),
                "phase": serializers.CharField(),
                "requirements": serializers.ListField(),
                "limitations": serializers.ListField(),
            },
        )
    )
    def get(self, request):
        return Response(
            {
                "enabled": is_enabled("z_trigger"),
                "phase": "experimental",
                "default": "off",
                "requirements": [
                    "explicit opt-in consent",
                    "Bluetooth permission",
                    "foreground location at confirmation",
                ],
                "limitations": [
                    "iOS cannot monitor Bluetooth after the app is terminated",
                    "Android background execution is not guaranteed",
                    "A disconnect does not prove the car is parked or that a space is free",
                    "Detected events are private and never become public vacancy observations",
                ],
            }
        )


class ParkEventCreateView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CreateEventSerializer

    @extend_schema(responses={201: ParkEventSerializer})
    def post(self, request):
        _guard()
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        p = Point(d["longitude"], d["latitude"], srid=4326)
        area = (
            ParkingArea.objects.filter(is_active=True, location__dwithin=(p, D(m=60)))
            .annotate(d=Distance("location", p))
            .order_by("d")
            .first()
        )
        e = ParkingEvent.objects.create(
            user=request.user,
            location=p,
            accuracy_m=d.get("accuracy_m"),
            detected_at=d["detected_at"],
            source=d["source"],
            area=area,
        )
        return Response(ParkEventSerializer(e).data, status=status.HTTP_201_CREATED)


class ParkEventActionView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ParkEventSerializer
    action = "confirm"

    def post(self, request, pk):
        _guard()
        e = ParkingEvent.objects.filter(pk=pk, user=request.user).first()
        if e is None:
            raise ZpotAPIError("Event not found.", code="not_found", status_code=404)
        if e.status != ParkEventStatus.DETECTED:
            raise ZpotAPIError("This event was already handled.", code="already_handled", status_code=409)
        e.status = ParkEventStatus.CONFIRMED if self.action == "confirm" else ParkEventStatus.DISMISSED
        e.save(update_fields=["status"])
        return Response(ParkEventSerializer(e).data)
