"""Response schemas for OpenAPI documentation of the parking endpoints (documentation only)."""

from rest_framework import serializers

CATEGORY = ["free", "free_time_limited", "paid", "unknown", "restricted"]


class LatLngSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class ReasonDocSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    at = serializers.DateTimeField(allow_null=True)


class SourceDocSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    kind = serializers.CharField()
    is_development_fixture = serializers.BooleanField()
    attribution = serializers.CharField()


class CoverageDocSerializer(serializers.Serializer):
    status = serializers.ChoiceField(["full", "partial", "mapping", "outside_mapped_areas", "unsupported"])
    city = serializers.CharField(allow_null=True)
    area = serializers.DictField(allow_null=True)
    note = serializers.CharField()


class ParkingOptionDocSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    address = serializers.CharField()
    kind = serializers.ChoiceField(["on_street", "car_park", "bay"])
    location = LatLngSerializer()
    geometry = serializers.DictField(help_text="GeoJSON geometry (LineString street, Polygon car park, Point)")
    category = serializers.ChoiceField(CATEGORY)
    rank = serializers.IntegerField(help_text="0 free · 1 free with time rules · 2 paid · 3 unknown · 4 restricted")
    is_recommended = serializers.BooleanField()
    legal_status = serializers.ChoiceField(["permitted", "permitted_until", "not_permitted", "unknown"])
    pricing_status = serializers.ChoiceField(["free", "paid", "unknown", "not_applicable"])
    eligibility_status = serializers.ChoiceField(
        ["eligible", "permit_required", "badge_required", "vehicle_not_allowed", "unknown"]
    )
    availability_status = serializers.ChoiceField(
        ["unknown", "recently_reported_available", "reported_occupied", "conflicting_reports"]
    )
    availability = serializers.DictField()
    expected_total_cost = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    currency = serializers.CharField()
    arrival_at = serializers.DateTimeField()
    duration_minutes = serializers.IntegerField()
    leave_by = serializers.DateTimeField(allow_null=True)
    leave_by_reason = ReasonDocSerializer(allow_null=True)
    blocking_reason = ReasonDocSerializer(allow_null=True)
    has_paid_periods = serializers.BooleanField()
    walking_distance_meters = serializers.IntegerField()
    walking_duration_minutes = serializers.IntegerField()
    distance_meters = serializers.IntegerField()
    verified_at = serializers.DateTimeField(allow_null=True)
    verification_status = serializers.ChoiceField(["verified", "community", "unverified"])
    data_source = SourceDocSerializer(allow_null=True)
    evidence_status = serializers.CharField()
    confidence_label = serializers.ChoiceField(["high", "medium", "low"])
    is_accessible = serializers.BooleanField()
    explanation_codes = serializers.ListField(child=serializers.CharField())
    recommendation_reason = serializers.DictField()
    commercial = serializers.DictField(allow_null=True, help_text="Disclosure only; never affects ranking.")


class ParkingOptionsResponseSerializer(serializers.Serializer):
    query = serializers.DictField()
    coverage = CoverageDocSerializer()
    summary = serializers.DictField()
    recommended_id = serializers.IntegerField(allow_null=True)
    count = serializers.IntegerField()
    next_cursor = serializers.CharField(allow_null=True)
    results = ParkingOptionDocSerializer(many=True)
    disclaimer = serializers.CharField()


class ParkingAreaDetailDocSerializer(ParkingOptionDocSerializer):
    supported_area = serializers.DictField(allow_null=True)
    operator_name = serializers.CharField(allow_null=True)
    capacity_estimate = serializers.IntegerField(allow_null=True)
    rule_lines = serializers.ListField(child=serializers.CharField())
    evidence_count = serializers.IntegerField()
    disclaimer = serializers.CharField()


class SpotsNearbyResponseSerializer(serializers.Serializer):
    spots = serializers.ListField(child=serializers.DictField())
    ranking = serializers.CharField()
    canonical_endpoint = serializers.CharField()
    coverage = CoverageDocSerializer()


class AreaRulesResponseSerializer(serializers.Serializer):
    area_id = serializers.IntegerField()
    verification_status = serializers.CharField()
    rules = serializers.ListField(child=serializers.DictField())
    restrictions = serializers.ListField(child=serializers.DictField())
    closures = serializers.ListField(child=serializers.DictField())
    rule_lines = serializers.ListField(child=serializers.CharField())


class AreaEvidenceResponseSerializer(serializers.Serializer):
    area_id = serializers.IntegerField()
    evidence_status = serializers.CharField()
    verification_status = serializers.CharField()
    verified_at = serializers.DateTimeField(allow_null=True)
    evidence = serializers.ListField(child=serializers.DictField())


class ObservationsResponseSerializer(serializers.Serializer):
    area_id = serializers.IntegerField()
    observations = serializers.ListField(child=serializers.DictField())
    note = serializers.CharField()


class MapLayersResponseSerializer(serializers.Serializer):
    type = serializers.CharField(default="FeatureCollection")
    features = serializers.ListField(child=serializers.DictField(), help_text="GeoJSON features with category/layer")


class CompareResponseSerializer(serializers.Serializer):
    results = ParkingOptionDocSerializer(many=True)
    best_id = serializers.IntegerField(allow_null=True)
