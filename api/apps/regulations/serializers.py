from rest_framework import serializers

from .models import ParkingRestriction, ParkingRule, ParkingTimeWindow, TemporaryClosure
from .services.describe import restriction_line, rule_line, validity_suffix, window_text


class TimeWindowSerializer(serializers.ModelSerializer):
    text = serializers.SerializerMethodField()

    class Meta:
        model = ParkingTimeWindow
        fields = ["days", "start_minute", "end_minute", "text"]

    def get_text(self, obj) -> str:
        return window_text(obj)


class SourceMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    kind = serializers.CharField()
    is_development_fixture = serializers.BooleanField()


class ParkingRuleSerializer(serializers.ModelSerializer):
    windows = TimeWindowSerializer(many=True, read_only=True)
    tariff = serializers.SerializerMethodField()
    permit_type = serializers.SlugRelatedField(slug_field="code", read_only=True)
    source = SourceMiniSerializer(read_only=True)
    text = serializers.SerializerMethodField()

    class Meta:
        model = ParkingRule
        fields = [
            "id",
            "area",
            "kind",
            "label",
            "text",
            "windows",
            "tariff",
            "permit_type",
            "max_stay_minutes",
            "vehicle_classes",
            "valid_from",
            "valid_until",
            "source",
            "verified_at",
        ]

    def get_tariff(self, obj) -> dict | None:
        t = obj.tariff
        if not t:
            return None
        return {
            "rate_per_hour": str(t.rate_per_hour),
            "currency": t.currency,
            "billing_increment_minutes": t.billing_increment_minutes,
            "minimum_charge": str(t.minimum_charge),
        }

    def get_text(self, obj) -> str:
        return rule_line(obj) + validity_suffix(obj)


class ParkingRestrictionSerializer(serializers.ModelSerializer):
    windows = TimeWindowSerializer(many=True, read_only=True)
    exempt_permit_type = serializers.SlugRelatedField(slug_field="code", read_only=True)
    source = SourceMiniSerializer(read_only=True)
    text = serializers.SerializerMethodField()

    class Meta:
        model = ParkingRestriction
        fields = [
            "id",
            "area",
            "kind",
            "label",
            "text",
            "windows",
            "exempt_permit_type",
            "vehicle_classes",
            "valid_from",
            "valid_until",
            "source",
            "verified_at",
        ]

    def get_text(self, obj) -> str:
        return restriction_line(obj) + validity_suffix(obj)


class TemporaryClosureSerializer(serializers.ModelSerializer):
    area_name = serializers.CharField(source="area.name", read_only=True)
    location = serializers.SerializerMethodField()

    class Meta:
        model = TemporaryClosure
        fields = ["id", "area", "area_name", "reason", "starts_at", "ends_at", "verified_at", "location"]

    def get_location(self, obj) -> dict:
        return {"latitude": obj.area.location.y, "longitude": obj.area.location.x}


class EvaluateRequestSerializer(serializers.Serializer):
    area_id = serializers.IntegerField()
    arrival_at = serializers.DateTimeField(required=False)
    duration_minutes = serializers.IntegerField(min_value=15, max_value=1440, default=120)
    vehicle_class = serializers.ChoiceField(choices=["car", "motorcycle", "van", "ev"], default="car")
    permit_type = serializers.SlugField(required=False, allow_blank=True)
    has_disabled_badge = serializers.BooleanField(default=False)
