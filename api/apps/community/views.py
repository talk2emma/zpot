from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.availability.services import karma

from .models import ReportVerification

ContributionsOut = inline_serializer(
    "Contributions",
    {
        "karma": serializers.FloatField(),
        "reports": serializers.IntegerField(),
        "accepted": serializers.IntegerField(),
        "published": serializers.IntegerField(),
        "verifications": serializers.IntegerField(),
        "level": serializers.CharField(),
        "recent_events": serializers.ListField(child=serializers.DictField()),
    },
)


class MyContributionsView(GenericAPIView):
    """Contributor recognition. Reputation never overrides verified legal restrictions."""

    permission_classes = [IsAuthenticated]
    serializer_class = None

    @extend_schema(responses=ContributionsOut)
    def get(self, request):
        u = request.user
        agg = u.reports.aggregate(
            total=Count("id"),
            accepted=Count("id", filter=Q(status="accepted")),
            published=Count("id", filter=Q(status__in=["published", "expired", "superseded"])),
        )
        k = karma(u)
        level = "trusted" if k >= 0.7 and agg["accepted"] >= 3 else "contributor" if agg["total"] >= 1 else "new"
        return Response(
            {
                "karma": round(k, 3),
                "reports": agg["total"],
                "accepted": agg["accepted"],
                "published": agg["published"],
                "verifications": ReportVerification.objects.filter(voter=u).count(),
                "level": level,
                "recent_events": [
                    {"reason": e.reason, "delta": e.delta, "created_at": e.created_at}
                    for e in u.trust_events.all()[:10]
                ],
            }
        )
