"""Commute planner: the canonical search (search_parking + ranking_key) is run for each planned weekday.

Free plan: the soonest planned day is checked; other days are returned as `locked` (Pro is not purchasable here).
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.gis.geos import Point
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import ZpotAPIError
from apps.monetization.entitlements import limit
from apps.parking.services.search import SearchParams, search_parking
from apps.regulations.services.engine import Driver

from .models import CommutePlan

TZ = ZoneInfo("Europe/Lisbon")


class CommutePlanSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True, min_value=-90, max_value=90)
    longitude = serializers.FloatField(write_only=True, min_value=-180, max_value=180)
    location = serializers.SerializerMethodField()
    days = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=6), min_length=1, max_length=7)
    arrival_minute = serializers.IntegerField(min_value=0, max_value=1439)
    duration_minutes = serializers.IntegerField(min_value=15, max_value=1440)

    class Meta:
        model = CommutePlan
        fields = [
            "id",
            "label",
            "name",
            "latitude",
            "longitude",
            "location",
            "days",
            "arrival_minute",
            "duration_minutes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_location(self, o) -> dict:
        return {"latitude": o.location.y, "longitude": o.location.x}

    def validate(self, attrs):
        if ("latitude" in attrs) != ("longitude" in attrs):
            raise serializers.ValidationError({"latitude": ["Send latitude and longitude together."]})
        return attrs

    def validate_days(self, v):
        return sorted(set(v))

    def _point(self, d):
        if "latitude" in d or "longitude" in d:
            d["location"] = Point(d.pop("longitude"), d.pop("latitude"), srid=4326)
        return d

    def create(self, d):
        return super().create(self._point(d))

    def update(self, o, d):
        return super().update(o, self._point(d))


def _driver(user):
    p = getattr(user, "preferences", None)
    return Driver(
        vehicle_class=getattr(p, "vehicle_class", "car"),
        permits=frozenset([p.permit_type.code]) if p and p.permit_type_id else frozenset(),
        has_disabled_badge=getattr(p, "has_disabled_badge", False),
    )


def next_dates(days, arrival_minute, now=None):
    """Next local occurrence of each weekday at the arrival time, soonest first (today counts if still ahead)."""
    now = (now or timezone.now()).astimezone(TZ)
    out = []
    for wd in days:
        delta = (wd - now.weekday()) % 7
        d = now.date() + timedelta(days=delta)
        at = datetime(d.year, d.month, d.day, arrival_minute // 60, arrival_minute % 60, tzinfo=TZ)
        if at <= now:
            at += timedelta(days=7)
        out.append((wd, at))
    return sorted(out, key=lambda x: x[1])


def check(plan, user):
    S = settings.ZPOT["SEARCH_DEFAULTS"]
    visible = limit(user, "commute_days_visible")
    rows = []
    for i, (wd, at) in enumerate(next_dates(plan.days, plan.arrival_minute)):
        row = {"weekday": wd, "arrival_at": at.isoformat(), "locked": i >= visible, "best": None, "free_options": None}
        if not row["locked"]:
            res = search_parking(
                SearchParams(
                    latitude=plan.location.y,
                    longitude=plan.location.x,
                    arrival_at=at,
                    duration_minutes=plan.duration_minutes,
                    radius_meters=S["radius_meters"],
                    max_walk_minutes=S["max_walk_minutes"],
                    driver=_driver(user),
                    include_paid=True,
                    limit=5,
                )
            )
            o = res.recommended or (res.options[0] if res.options else None)
            row["free_options"] = res.summary.get("free_options")
            if o:
                ev = o.evaluation
                row["best"] = {
                    "area_id": o.area.id,
                    "name": o.area.name,
                    "category": ev.category.value,
                    "expected_total_cost": str(ev.expected_total_cost) if ev.expected_total_cost is not None else None,
                    "leave_by": ev.leave_by.isoformat() if ev.leave_by else None,
                    "leave_by_reason": ev.leave_by_reason.as_dict() if ev.leave_by_reason else None,
                    "walking_duration_minutes": o.walking_duration_minutes,
                    "is_recommended": o.is_recommended,
                }
        rows.append(row)
    return {
        "plan_id": plan.id,
        "checked_at": timezone.now().isoformat(),
        "days": rows,
        "note": "Results use the parking rules on file and are re-checked on demand. Availability is never confirmed.",
    }


CheckSerializer = inline_serializer(
    "CommuteCheck",
    {
        "plan_id": serializers.IntegerField(),
        "checked_at": serializers.DateTimeField(),
        "days": serializers.ListField(child=serializers.DictField()),
        "note": serializers.CharField(),
    },
)


class CommuteListView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CommutePlanSerializer

    @extend_schema(responses={200: CommutePlanSerializer(many=True)})
    def get(self, request):
        return Response(self.get_serializer(CommutePlan.objects.filter(user=request.user), many=True).data)

    @extend_schema(responses={201: CommutePlanSerializer})
    def post(self, request):
        if CommutePlan.objects.filter(user=request.user).count() >= 10:
            raise ZpotAPIError("You can keep up to 10 commute plans.", code="plan_limit", status_code=403)
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(self.get_serializer(s.save(user=request.user)).data, status=status.HTTP_201_CREATED)


class CommuteDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CommutePlanSerializer

    def _get(self, request, pk):
        p = CommutePlan.objects.filter(user=request.user, pk=pk).first()
        if p is None:
            raise ZpotAPIError("Commute plan not found.", code="not_found", status_code=404)
        return p

    @extend_schema(responses={200: CommutePlanSerializer})
    def patch(self, request, pk):
        s = self.get_serializer(self._get(request, pk), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        return Response(self.get_serializer(s.save()).data)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        self._get(request, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommuteCheckView(CommuteDetailView):
    @extend_schema(request=None, responses={200: CheckSerializer})
    def get(self, request, pk):
        return Response(check(self._get(request, pk), request.user))
