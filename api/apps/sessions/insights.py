"""Savings & history. Savings are only counted for sessions where the driver entered what they paid."""

import math
from collections import defaultdict
from decimal import Decimal

from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import ZpotAPIError
from apps.monetization.entitlements import limit

from .models import ParkingSession


def _alternatives(supported_area_ids):
    """Paid areas with a tariff, cheapest first, per supported area — one query (same rule as services.summary)."""
    from apps.parking.models import ParkingArea

    out = defaultdict(list)
    rows = (
        ParkingArea.objects.filter(
            supported_area_id__in=supported_area_ids, rules__kind="paid", rules__tariff__isnull=False
        )
        .order_by("rules__tariff__rate_per_hour")
        .values_list("supported_area_id", "id", "rules__tariff__rate_per_hour")
    )
    for sa, area_id, rate in rows:
        out[sa].append((area_id, Decimal(rate)))
    return out


def insights(user):
    """Totals over all of the user's finished sessions in a fixed number of queries (no per-session lookups)."""
    now = timezone.now()
    rows = list(
        ParkingSession.objects.filter(user=user)
        .exclude(status="active")
        .values_list("started_at", "ended_at", "cost_paid", "area_id", "area__supported_area_id")
    )
    minutes_total, paid, saving, counted, with_cost = 0, Decimal("0"), Decimal("0"), 0, 0
    alts = _alternatives({r[4] for r in rows if r[2] is not None and r[4] is not None})
    for started, ended, cost, area_id, sa in rows:
        minutes = max(0, int(((ended or now) - started).total_seconds() // 60))
        minutes_total += minutes
        if cost is None:
            continue
        with_cost += 1
        paid += cost
        alt = next((rate for a, rate in alts.get(sa, []) if a != area_id), None)
        if alt is not None:
            alt_cost = alt * max(1, math.ceil(minutes / 60))
            if alt_cost > cost:
                saving += (alt_cost - cost).quantize(Decimal("0.01"))
                counted += 1
    return {
        "sessions": len(rows),
        "parked_minutes": minutes_total,
        "sessions_with_cost": with_cost,
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
