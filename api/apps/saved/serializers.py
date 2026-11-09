from django.utils import timezone
from rest_framework import serializers

from apps.parking.selectors import areas_with_regulations
from apps.regulations.services.engine import Driver, evaluate
from apps.regulations.services.specs import area_spec

from .models import SavedDestination, SavedParkingLocation, SearchHistory


class SavedLocationSerializer(serializers.ModelSerializer):
    area = serializers.SerializerMethodField()
    current = serializers.SerializerMethodField()

    class Meta:
        model = SavedParkingLocation
        fields = ["id", "label", "area", "category_at_save", "current", "created_at", "updated_at"]

    def get_area(self, o) -> dict:
        a = o.area
        return {
            "id": a.id,
            "name": a.name,
            "latitude": a.location.y,
            "longitude": a.location.x,
            "verification_status": a.verification_status,
        }

    def get_current(self, o) -> dict:
        """Re-checked now for a 2 h stay so a rule change since saving is visible."""
        prefs = getattr(o.user, "preferences", None)
        d = Driver(
            vehicle_class=getattr(prefs, "vehicle_class", "car"),
            permits=frozenset([prefs.permit_type.code]) if prefs and prefs.permit_type_id else frozenset(),
            has_disabled_badge=getattr(prefs, "has_disabled_badge", False),
        )
        ev = evaluate(area_spec(o.area), timezone.now(), 120, d)
        changed = bool(o.category_at_save) and ev.category.value == "restricted" and o.category_at_save != "restricted"
        return {
            "category": ev.category.value,
            "checked_for": "now + 2 h",
            "rules_changed": changed,
            "blocking_reason": ev.blocking_reason.as_dict() if ev.blocking_reason else None,
        }


class CreateSavedLocationSerializer(serializers.Serializer):
    area_id = serializers.IntegerField()
    label = serializers.CharField(max_length=80, required=False, allow_blank=True)

    def validate_area_id(self, v):
        if not areas_with_regulations().filter(pk=v, is_active=True).exists():
            raise serializers.ValidationError("Parking area not found.")
        return v


class RenameSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=80)

    def validate_label(self, v):
        if not v.strip():
            raise serializers.ValidationError("Enter a name.")
        return v.strip()


class ImportSerializer(serializers.Serializer):
    items = CreateSavedLocationSerializer(many=True)


class LocationField(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)


class SavedDestinationSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True, min_value=-90, max_value=90)
    longitude = serializers.FloatField(write_only=True, min_value=-180, max_value=180)
    location = serializers.SerializerMethodField()

    class Meta:
        model = SavedDestination
        fields = ["id", "label", "place_ref", "name", "subtitle", "latitude", "longitude", "location", "created_at"]

    def get_location(self, o) -> dict:
        return {"latitude": o.location.y, "longitude": o.location.x}


class SearchHistorySerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True, min_value=-90, max_value=90)
    longitude = serializers.FloatField(write_only=True, min_value=-180, max_value=180)
    location = serializers.SerializerMethodField()

    class Meta:
        model = SearchHistory
        fields = ["id", "place_ref", "name", "subtitle", "latitude", "longitude", "location", "searched_at"]

    def get_location(self, o) -> dict:
        return {"latitude": o.location.y, "longitude": o.location.x}
