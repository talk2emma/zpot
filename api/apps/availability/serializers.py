from django.utils import timezone
from rest_framework import serializers

from .models import ParkingObservation
from .services import state_of


class ObservationSerializer(serializers.ModelSerializer):
    """Public view: no reporter identity."""

    age_minutes = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    report_id = serializers.SerializerMethodField()
    area_name = serializers.SerializerMethodField()

    class Meta:
        model = ParkingObservation
        fields = [
            "id",
            "kind",
            "state",
            "area",
            "area_name",
            "location",
            "observed_at",
            "expires_at",
            "confirmations",
            "contradictions",
            "age_minutes",
            "report_id",
        ]

    def get_age_minutes(self, obj) -> int:
        return int((timezone.now() - obj.observed_at).total_seconds() // 60)

    def get_state(self, obj) -> str:
        return state_of(obj).value

    def get_location(self, obj) -> dict:
        return {"latitude": obj.location.y, "longitude": obj.location.x}

    def get_report_id(self, obj) -> str | None:
        r = getattr(obj, "report", None)
        return str(r.id) if r else None

    def get_area_name(self, obj) -> str | None:
        return obj.area.name if obj.area_id else None


class CreateObservationSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["available", "leaving", "occupied"])
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    area_id = serializers.IntegerField(required=False, allow_null=True)
    device_latitude = serializers.FloatField(required=False)
    device_longitude = serializers.FloatField(required=False)


class NearbyQuerySerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    radius_meters = serializers.IntegerField(min_value=50, max_value=2000, default=800)


class VerifyCompatSerializer(serializers.Serializer):
    observation_id = serializers.IntegerField()
    answer = serializers.ChoiceField(choices=["still_available", "taken", "unsure", "yes", "no"])
