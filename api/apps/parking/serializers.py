import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from apps.regulations.services.engine import Driver

from .models import ParkingArea, ParkingEvidence

S = settings.ZPOT["SEARCH_DEFAULTS"]
VEHICLES = ["car", "motorcycle", "van", "ev"]


def parse_arrival(value: datetime | None, tz_name: str) -> datetime:
    if value is None:
        return timezone.now()
    if timezone.is_naive(value):
        return value.replace(tzinfo=ZoneInfo(tz_name))
    return value


def driver_from_params(d) -> Driver:
    permits = frozenset([d["permit_type"]]) if d.get("permit_type") else frozenset()
    return Driver(
        vehicle_class=d.get("vehicle_class") or "car",
        permits=permits,
        has_disabled_badge=bool(d.get("has_disabled_badge")),
    )


class StayParamsSerializer(serializers.Serializer):
    arrival_at = serializers.DateTimeField(required=False, help_text="ISO 8601. Naive values are city-local time.")
    duration_minutes = serializers.IntegerField(
        required=False, min_value=15, max_value=1440, default=S["duration_minutes"]
    )
    vehicle_class = serializers.ChoiceField(choices=VEHICLES, required=False, default="car")
    permit_type = serializers.SlugField(required=False, allow_blank=True)
    has_disabled_badge = serializers.BooleanField(required=False, default=False)

    def validate_arrival_at(self, value):
        if value is None:
            return value
        aware = value if timezone.is_aware(value) else value.replace(tzinfo=ZoneInfo("Europe/Lisbon"))
        now = timezone.now()
        if aware < now - timedelta(hours=1):
            raise serializers.ValidationError("Arrival time can't be in the past.", code="arrival_in_past")
        if aware > now + timedelta(days=90):
            raise serializers.ValidationError("Arrival time must be within the next 90 days.", code="arrival_too_far")
        return value


class SearchQuerySerializer(StayParamsSerializer):
    latitude = serializers.FloatField(
        required=False,
        min_value=-90,
        max_value=90,
        help_text="Driver's current position (used when no destination is given).",
    )
    longitude = serializers.FloatField(required=False, min_value=-180, max_value=180)
    destination_latitude = serializers.FloatField(required=False, min_value=-90, max_value=90)
    destination_longitude = serializers.FloatField(required=False, min_value=-180, max_value=180)
    radius_meters = serializers.IntegerField(
        required=False, min_value=100, max_value=S["max_radius_meters"], default=S["radius_meters"]
    )
    max_walk_minutes = serializers.IntegerField(
        required=False, min_value=1, max_value=30, default=S["max_walk_minutes"]
    )
    max_price = serializers.DecimalField(required=False, max_digits=6, decimal_places=2, min_value=0)
    free_only = serializers.BooleanField(required=False, default=False)
    include_paid = serializers.BooleanField(required=False, default=False)
    verified_only = serializers.BooleanField(required=False, default=False)
    accessible_only = serializers.BooleanField(required=False, default=False)
    include_restricted = serializers.BooleanField(required=False, default=False)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=50, default=S["limit"])
    cursor = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        has_dest = "destination_latitude" in attrs or "destination_longitude" in attrs
        if has_dest and not ("destination_latitude" in attrs and "destination_longitude" in attrs):
            raise serializers.ValidationError(
                {"destination_longitude": "destination_latitude and destination_longitude must be sent together."}
            )
        has_pos = "latitude" in attrs or "longitude" in attrs
        if has_pos and not ("latitude" in attrs and "longitude" in attrs):
            raise serializers.ValidationError({"longitude": "latitude and longitude must be sent together."})
        if not has_dest and not has_pos:
            raise serializers.ValidationError(
                {"destination_latitude": "Provide a destination or your current position."}, code="location_required"
            )
        if attrs.get("free_only") and attrs.get("include_paid"):
            raise serializers.ValidationError(
                {"include_paid": "free_only and include_paid can't both be true."}, code="conflicting_filters"
            )
        if attrs.get("max_price") is not None and not attrs.get("include_paid"):
            raise serializers.ValidationError(
                {"max_price": "max_price only applies when include_paid=true."}, code="conflicting_filters"
            )
        if attrs.get("cursor"):
            from .services.search import decode_cursor

            try:
                attrs["offset"] = decode_cursor(attrs["cursor"])
            except (ValueError, UnicodeDecodeError) as exc:
                raise serializers.ValidationError({"cursor": "Invalid cursor."}) from exc
        return attrs


class MapLayersQuerySerializer(StayParamsSerializer):
    bbox = serializers.CharField(help_text="min_lon,min_lat,max_lon,max_lat (WGS84)")

    def validate_bbox(self, value):
        try:
            parts = [float(x) for x in value.split(",")]
        except ValueError as exc:
            raise serializers.ValidationError("bbox must be four numbers.") from exc
        if len(parts) != 4:
            raise serializers.ValidationError("bbox must be four numbers.")
        x1, y1, x2, y2 = parts
        if not (-180 <= x1 < x2 <= 180 and -90 <= y1 < y2 <= 90):
            raise serializers.ValidationError("bbox is not a valid extent.")
        if (x2 - x1) > 0.2 or (y2 - y1) > 0.2:
            raise serializers.ValidationError("bbox too large — zoom in.", code="bbox_too_large")
        return parts


class CompareQuerySerializer(StayParamsSerializer):
    ids = serializers.CharField(help_text="Comma-separated parking area ids (2–5).")
    latitude = serializers.FloatField(required=False)
    longitude = serializers.FloatField(required=False)

    def validate_ids(self, value):
        try:
            ids = [int(x) for x in value.split(",") if x.strip()]
        except ValueError as exc:
            raise serializers.ValidationError("ids must be integers.") from exc
        if not 2 <= len(set(ids)) <= 5:
            raise serializers.ValidationError("Compare 2 to 5 parking areas.")
        return list(dict.fromkeys(ids))


class ReasonSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    at = serializers.DateTimeField(allow_null=True)


class EvaluationSerializer(serializers.Serializer):
    area_id = serializers.IntegerField()
    arrival_at = serializers.DateTimeField()
    departure_at = serializers.DateTimeField()
    legal_status = serializers.CharField()
    pricing_status = serializers.CharField()
    eligibility_status = serializers.CharField()
    category = serializers.CharField()
    expected_total_cost = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    currency = serializers.SerializerMethodField()
    paid_minutes = serializers.IntegerField()
    leave_by = serializers.DateTimeField(allow_null=True)
    leave_by_reason = serializers.SerializerMethodField()
    blocking_reason = serializers.SerializerMethodField()
    has_paid_periods = serializers.BooleanField()
    explanation_codes = serializers.ListField(child=serializers.CharField())

    def get_currency(self, obj) -> str:
        return "EUR"

    def get_leave_by_reason(self, obj) -> dict | None:
        return obj.leave_by_reason.as_dict() if obj.leave_by_reason else None

    def get_blocking_reason(self, obj) -> dict | None:
        return obj.blocking_reason.as_dict() if obj.blocking_reason else None


def area_geometry(area):
    if area.geometry is not None:
        return json.loads(area.geometry.geojson)
    return {"type": "Point", "coordinates": [area.location.x, area.location.y]}


def source_dict(area):
    s = area.data_source
    if not s:
        return None
    return {
        "id": s.id,
        "name": s.name,
        "kind": s.kind,
        "is_development_fixture": s.is_development_fixture,
        "attribution": s.attribution,
    }


HEADLINES = {
    "free": "Free for your whole stay",
    "free_time_limited": "Free during your selected hours",
    "paid": "Paid · about €{cost} for your stay",
    "unknown": "Rules not confirmed — check the signs",
    "restricted": "Not available for your stay",
}


def recommendation_reason(option):
    ev = option.evaluation
    params = {"walk_minutes": option.walking_duration_minutes}
    code = ev.category.value
    text = HEADLINES[code]
    if ev.category.value == "paid":
        params["cost"] = str(ev.expected_total_cost)
        text = text.format(cost=ev.expected_total_cost)
    if ev.leave_by is not None and ev.category.value != "restricted":
        code = "free_until" if ev.category.value != "paid" else "paid_until"
        params["leave_by"] = ev.leave_by.isoformat()
        params["leave_by_reason"] = ev.leave_by_reason.code
        if ev.category.value != "paid":
            text = "Free until {}".format(ev.leave_by.astimezone(ZoneInfo(option.area.city.timezone)).strftime("%H:%M"))
    if ev.blocking_reason:
        params["blocking_reason"] = ev.blocking_reason.code
        text = ev.blocking_reason.label
    return {"code": code, "params": params, "text": f"{text} · {option.walking_duration_minutes} min walk"}


class ParkingOptionSerializer(serializers.Serializer):
    """Section 8.8 parking response model."""

    def to_representation(self, o):
        a, ev = o.area, o.evaluation
        ev_data = EvaluationSerializer(ev).data
        return {
            "id": a.id,
            "name": a.name,
            "address": a.address,
            "kind": a.kind,
            "location": {"latitude": a.location.y, "longitude": a.location.x},
            "geometry": area_geometry(a),
            "category": ev.category.value,
            "rank": ev.rank,
            "is_recommended": o.is_recommended,
            "legal_status": ev.legal_status.value,
            "pricing_status": ev.pricing_status.value,
            "eligibility_status": ev.eligibility_status.value,
            "availability_status": o.availability.get("status", "unknown"),
            "availability": o.availability,
            "expected_total_cost": ev_data["expected_total_cost"],
            "currency": "EUR",
            "arrival_at": ev_data["arrival_at"],
            "duration_minutes": int((ev.departure_at - ev.arrival_at).total_seconds() // 60),
            "leave_by": ev_data["leave_by"],
            "leave_by_reason": ev_data["leave_by_reason"],
            "blocking_reason": ev_data["blocking_reason"],
            "has_paid_periods": ev.has_paid_periods,
            "walking_distance_meters": o.walking_distance_meters,
            "walking_duration_minutes": o.walking_duration_minutes,
            "distance_meters": round(o.distance_meters),
            "verified_at": a.verified_at.isoformat() if a.verified_at else None,
            "verification_status": a.verification_status,
            "data_source": source_dict(a),
            "evidence_status": a.evidence_status,
            "confidence_label": o.confidence,
            "is_accessible": a.is_accessible,
            "explanation_codes": ev.explanation_codes,
            "recommendation_reason": recommendation_reason(o),
            # Labelled commercial metadata. Present for disclosure only — never affects order.
            "commercial": {
                "is_partner": a.is_commercial_partner,
                "offer": a.partner_offer or None,
                "ev_charging": a.ev_charging_note or None,
            }
            if a.is_commercial_partner
            else None,
        }


class ParkingAreaListSerializer(serializers.ModelSerializer):
    location = serializers.SerializerMethodField()
    data_source = serializers.SerializerMethodField()

    class Meta:
        model = ParkingArea
        fields = [
            "id",
            "name",
            "address",
            "kind",
            "location",
            "verification_status",
            "verified_at",
            "evidence_status",
            "is_accessible",
            "data_source",
        ]

    def get_location(self, obj) -> dict:
        return {"latitude": obj.location.y, "longitude": obj.location.x}

    def get_data_source(self, obj) -> dict | None:
        return source_dict(obj)


class EvidenceSerializer(serializers.ModelSerializer):
    source = serializers.SerializerMethodField()

    class Meta:
        model = ParkingEvidence
        fields = ["id", "kind", "description", "captured_at", "url", "source"]

    def get_source(self, obj) -> dict:
        s = obj.source
        return {"id": s.id, "name": s.name, "kind": s.kind, "is_development_fixture": s.is_development_fixture}
