from django.http import FileResponse
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.exceptions import ZpotAPIError
from apps.core.permissions import IsReviewer, client_token, has_role
from apps.core.uploads import sanitise_image

from . import services
from .models import CommunityReport, ReportAttachment
from .serializers import (
    AppealSerializer,
    AttachmentSerializer,
    CreateReportSerializer,
    ReportSerializer,
    ReviewerReportSerializer,
    UpdateReportSerializer,
    VerificationSerializer,
)


def _qs():
    return (
        CommunityReport.objects.select_related("area", "observation")
        .prefetch_related("attachments", "moderations")
        .select_related("appeal")
    )


def _get_visible(request, pk):
    r = _qs().filter(pk=pk).first()
    reviewer = has_role(request.user, "data_reviewer", "admin")
    if r is None or not services.visible_to(r, request.user, client_token(request), reviewer):
        raise ZpotAPIError("Report not found.", code="not_found", status_code=404)
    return r, reviewer


class ReportListCreateView(ListAPIView):
    """GET: moderation queue (reviewers only). POST: submit a report (guests may share vacancy signals)."""

    serializer_class = ReviewerReportSerializer
    throttle_scope = "reports"

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "POST" else [IsReviewer()]

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.request.method == "POST" else super().get_throttles()

    def get_queryset(self):
        qs = _qs()
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("type"):
            qs = qs.filter(type=p["type"])
        return qs

    @extend_schema(request=CreateReportSerializer, responses={201: ReportSerializer})
    def post(self, request):
        s = CreateReportSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        r = services.create_report(user=request.user, client_token=client_token(request), **s.validated_data)
        return Response(ReportSerializer(_qs().get(pk=r.pk)).data, status=status.HTTP_201_CREATED)


class MyReportsView(ListAPIView):
    serializer_class = ReportSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        u, tok = self.request.user, client_token(self.request)
        if u.is_authenticated:
            from django.db.models import Q

            q = Q(reporter=u)
            if tok:  # include reports made on this device before signing in
                q |= Q(client_token=tok, reporter__isnull=True)
            return _qs().filter(q)
        if not tok:
            return CommunityReport.objects.none()
        return _qs().filter(client_token=tok, reporter__isnull=True)


class ReportDetailView(GenericAPIView):
    serializer_class = ReportSerializer
    permission_classes = [AllowAny]

    def get(self, request, pk):
        r, reviewer = _get_visible(request, pk)
        return Response((ReviewerReportSerializer if reviewer else ReportSerializer)(r).data)

    @extend_schema(request=UpdateReportSerializer, responses=ReportSerializer)
    def patch(self, request, pk):
        r, reviewer = _get_visible(request, pk)
        s = UpdateReportSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if "decision" in d:
            if not reviewer:
                raise ZpotAPIError(
                    "Only the data team can moderate reports.", code="permission_denied", status_code=403
                )
            services.moderate(r, moderator=request.user, decision=d["decision"], reason=d.get("reason", ""))
        elif "description" in d:
            if r.status not in ("pending_review",) or reviewer:
                raise ZpotAPIError("This report can no longer be edited.", code="not_editable", status_code=409)
            r.description = d["description"].strip()
            r.save(update_fields=["description", "updated_at"])
        return Response((ReviewerReportSerializer if reviewer else ReportSerializer)(_qs().get(pk=r.pk)).data)


class ReportAttachmentView(GenericAPIView):
    serializer_class = AttachmentSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "uploads"

    @extend_schema(
        request={"multipart/form-data": inline_serializer("PhotoUpload", {"file": serializers.ImageField()})},
        responses={201: AttachmentSerializer},
    )
    def post(self, request, pk):
        r, reviewer = _get_visible(request, pk)
        if reviewer and r.reporter_id != getattr(request.user, "id", None):
            raise ZpotAPIError("Only the reporter can add photos.", code="permission_denied", status_code=403)
        if r.attachments.count() >= 3:
            raise ZpotAPIError("Up to 3 photos per report.", code="too_many_attachments", status_code=409)
        f, meta = sanitise_image(request.FILES.get("file"))
        a = ReportAttachment(report=r, **meta)
        a.file.save(f.name, f, save=True)
        return Response(AttachmentSerializer(a).data, status=status.HTTP_201_CREATED)


class ReportAttachmentDownloadView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = None

    @extend_schema(responses={(200, "image/jpeg"): bytes})
    def get(self, request, pk, attachment_id):
        r, _ = _get_visible(request, pk)
        a = r.attachments.filter(pk=attachment_id).first()
        if a is None:
            raise ZpotAPIError("Attachment not found.", code="not_found", status_code=404)
        return FileResponse(a.file.open("rb"), content_type=a.content_type)


class ReportVerificationView(GenericAPIView):
    serializer_class = VerificationSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verifications"

    @extend_schema(
        responses=inline_serializer(
            "VerificationResult",
            {
                "observation_id": serializers.IntegerField(),
                "state": serializers.CharField(),
                "confirmations": serializers.IntegerField(),
                "contradictions": serializers.IntegerField(),
                "expires_at": serializers.DateTimeField(),
            },
        )
    )
    def post(self, request, pk):
        r = CommunityReport.objects.select_related("observation").filter(pk=pk).first()
        if r is None or r.observation_id is None:
            raise ZpotAPIError("This report has no live observation to verify.", code="not_verifiable", status_code=404)
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        obs, st = services.verify_observation(
            observation_id=r.observation_id,
            answer=s.validated_data["answer"],
            user=request.user,
            client_token=client_token(request),
        )
        return Response(
            {
                "observation_id": obs.id,
                "state": st.value,
                "confirmations": obs.confirmations,
                "contradictions": obs.contradictions,
                "expires_at": obs.expires_at,
            }
        )


class ReportAppealView(GenericAPIView):
    serializer_class = AppealSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={201: ReportSerializer})
    def post(self, request, pk):
        r, _ = _get_visible(request, pk)
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.appeal(r, user=request.user, message=s.validated_data["message"])
        return Response(ReportSerializer(_qs().get(pk=r.pk)).data, status=status.HTTP_201_CREATED)
