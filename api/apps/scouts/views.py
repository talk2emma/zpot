from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.exceptions import ZpotAPIError
from apps.core.features import is_enabled
from apps.core.permissions import IsScout
from apps.regulations.services.describe import restriction_line, rule_line

from . import services
from .models import ScoutAssignment


class AssignmentSerializer(serializers.ModelSerializer):
    area = serializers.SerializerMethodField()
    current_rules = serializers.SerializerMethodField()
    last_submission = serializers.SerializerMethodField()

    class Meta:
        model = ScoutAssignment
        fields = ["id", "area", "reason", "status", "due_at", "current_rules", "last_submission", "created_at"]

    def get_area(self, o) -> dict:
        a = o.area
        return {
            "id": a.id,
            "name": a.name,
            "latitude": a.location.y,
            "longitude": a.location.x,
            "verification_status": a.verification_status,
        }

    def get_current_rules(self, o) -> list[str]:
        a = o.area
        lines = [rule_line(r) for r in a.rules.all()] + [restriction_line(r) for r in a.restrictions.all()]
        return lines or ["No rule on file."]

    def get_last_submission(self, o) -> dict | None:
        s = o.submissions.first()
        return (
            {
                "outcome": s.outcome,
                "review_status": s.review_status,
                "review_note": s.review_note,
                "submitted_at": s.submitted_at,
            }
            if s
            else None
        )


def _qs(user):
    return (
        ScoutAssignment.objects.filter(assigned_to=user)
        .select_related("area")
        .prefetch_related(
            "area__rules__windows",
            "area__rules__tariff",
            "area__rules__permit_type",
            "area__restrictions__windows",
            "submissions",
        )
    )


def _guard():
    if not is_enabled("scouts"):
        raise ZpotAPIError("Scout tasks are not enabled.", code="feature_disabled", status_code=404)


class AssignmentListView(ListAPIView):
    permission_classes = [IsScout]
    serializer_class = AssignmentSerializer
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return ScoutAssignment.objects.none()
        _guard()
        return _qs(self.request.user)


class AssignmentDetailView(GenericAPIView):
    permission_classes = [IsScout]
    serializer_class = AssignmentSerializer

    def get(self, request, pk):
        _guard()
        a = _qs(request.user).filter(pk=pk).first()
        if a is None:
            raise ZpotAPIError("Assignment not found.", code="not_found", status_code=404)
        return Response(self.get_serializer(a).data)


class AssignmentSubmitView(GenericAPIView):
    permission_classes = [IsScout]
    serializer_class = None
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        request={
            "multipart/form-data": inline_serializer(
                "ScoutSubmit",
                {
                    "outcome": serializers.ChoiceField(choices=["matches", "differs", "no_access"]),
                    "observed_rules": serializers.CharField(required=False),
                    "notes": serializers.CharField(required=False),
                    "photos": serializers.ListField(child=serializers.ImageField(), required=False),
                },
            )
        },
        responses={201: AssignmentSerializer},
    )
    def post(self, request, pk):
        _guard()
        a = _qs(request.user).filter(pk=pk).first()
        if a is None:
            raise ZpotAPIError("Assignment not found.", code="not_found", status_code=404)
        outcome = request.data.get("outcome")
        if outcome not in ("matches", "differs", "no_access"):
            raise ZpotAPIError("Choose an outcome.", code="validation_error", details={"outcome": ["Required."]})
        services.submit(
            a,
            scout=request.user,
            outcome=outcome,
            observed_rules=request.data.get("observed_rules", ""),
            notes=request.data.get("notes", ""),
            photos=request.FILES.getlist("photos"),
        )
        return Response(AssignmentSerializer(_qs(request.user).get(pk=a.pk)).data, status=status.HTTP_201_CREATED)
