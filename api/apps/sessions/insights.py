"""Savings & history. Savings are only counted for sessions where the driver entered what they paid."""

from decimal import Decimal

from django.db.models import Sum
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import ZpotAPIError
from apps.monetization.entitlements import limit

from . import services
from .models import ParkingSession

MAX_SESSIONS = 200


def insights(user):
    qs = (
        ParkingSession.objects.filter(user=user).exclude(status="active").select_related("area").order_by("-started_at")
    )
    rows = list(qs[:MAX_SESSIONS])
    minutes = sum(services.summary(s)["duration_minutes"] for s in rows)
    with_cost = [s for s in rows if s.cost_paid is not None]
    saving = Decimal("0")
    counted = 0
    for s in with_cost:
        est = services.summary(s)["estimated_saving"]
        if est:
            saving += Decimal(est["amount"])
            counted += 1
    paid = qs.filter(cost_paid__isnull=False).aggregate(t=Sum("cost_paid"))["t"] or Decimal("0")
    return {
        "sessions": qs.count(),
        "parked_minutes": minutes,
        "sessions_with_cost": len(with_cost),
        "paid_total": f"{paid:.2f}",
        "estimated_savings_total": f"{saving:.2f}" if counted else None,
        "estimated_savings_sessions": counted,
        "currency": "EUR",
        "export_available": limit(user, "insights_export"),
        "note": "Savings are estimates against the cheapest paid option nearby at sample tariffs, "
        "only for sessions where you entered what you paid. Not a guarantee.",
    }


InsightsSerializer = inline_serializer(
    "SessionInsights",
    {
        "sessions": serializers.IntegerField(),
        "parked_minutes": serializers.IntegerField(),
        "sessions_with_cost": serializers.IntegerField(),
        "paid_total": serializers.CharField(),
        "estimated_savings_total": serializers.CharField(allow_null=True),
        "estimated_savings_sessions": serializers.IntegerField(),
        "currency": serializers.CharField(),
        "export_available": serializers.BooleanField(),
        "note": serializers.CharField(),
    },
)


class InsightsView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = None

    @extend_schema(responses={200: InsightsSerializer})
    def get(self, request):
        return Response(insights(request.user))


class InsightsExportView(GenericAPIView):
    """Monthly CSV export is a Pro feature in the prototype; Pro cannot be purchased in this build."""

    permission_classes = [IsAuthenticated]
    serializer_class = None

    @extend_schema(
        responses={
            (200, "text/csv"): OpenApiTypes.STR,
            403: OpenApiResponse(description="plan_required: Pro is not available in this build"),
        }
    )
    def get(self, request):
        if not limit(request.user, "insights_export"):
            raise ZpotAPIError(
                "The monthly CSV report is part of Zpot Pro, which isn't available in this build.",
                code="plan_required",
                status_code=403,
            )
        raise ZpotAPIError("Not available.", code="plan_required", status_code=403)  # pragma: no cover
