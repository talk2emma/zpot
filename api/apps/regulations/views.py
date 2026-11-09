from django.utils import timezone
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import ZpotAPIError
from apps.parking.selectors import areas_with_regulations
from apps.parking.serializers import EvaluationSerializer, driver_from_params, parse_arrival

from .models import ParkingRule, TemporaryClosure
from .serializers import EvaluateRequestSerializer, ParkingRuleSerializer, TemporaryClosureSerializer
from .services.engine import evaluate
from .services.specs import area_spec


class RuleFilter(filters.FilterSet):
    area = filters.NumberFilter(field_name="area_id")
    city = filters.CharFilter(field_name="area__city__slug")
    kind = filters.CharFilter(field_name="kind")

    class Meta:
        model = ParkingRule
        fields = ["area", "city", "kind"]


class RegulationListView(ListAPIView):
    """Permission/charging rules (free, paid, permit-only, badge-only, max-stay)."""

    serializer_class = ParkingRuleSerializer
    permission_classes = [AllowAny]
    filterset_class = RuleFilter
    queryset = ParkingRule.objects.select_related("tariff", "permit_type", "source").prefetch_related("windows")


class RegulationDetailView(RetrieveAPIView):
    serializer_class = ParkingRuleSerializer
    permission_classes = [AllowAny]
    queryset = RegulationListView.queryset


class EvaluateView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=EvaluateRequestSerializer, responses=EvaluationSerializer)
    def post(self, request):
        s = EvaluateRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        area = areas_with_regulations().filter(pk=d["area_id"]).first()
        if area is None:
            raise ZpotAPIError("Parking area not found.", code="not_found", status_code=404)
        arrival = parse_arrival(d.get("arrival_at"), area.city.timezone)
        ev = evaluate(area_spec(area), arrival, d["duration_minutes"], driver_from_params(d))
        return Response(EvaluationSerializer(ev).data)


class ClosureFilter(filters.FilterSet):
    city = filters.CharFilter(field_name="area__city__slug")
    area = filters.NumberFilter(field_name="area_id")
    active_at = filters.IsoDateTimeFilter(method="filter_active_at")
    include_past = filters.BooleanFilter(method="filter_past")

    class Meta:
        model = TemporaryClosure
        fields = ["city", "area"]

    def filter_active_at(self, qs, name, value):
        return qs.filter(starts_at__lte=value, ends_at__gt=value)

    def filter_past(self, qs, name, value):
        return qs


class ClosureListView(ListAPIView):
    """Current and upcoming temporary closures (past ones excluded unless include_past=true)."""

    serializer_class = TemporaryClosureSerializer
    permission_classes = [AllowAny]
    filterset_class = ClosureFilter
    pagination_class = None

    def get_queryset(self):
        qs = TemporaryClosure.objects.select_related("area").order_by("starts_at")
        if self.request.query_params.get("include_past") not in ("true", "1"):
            qs = qs.filter(ends_at__gt=timezone.now())
        return qs
