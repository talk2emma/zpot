from django.http import FileResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import ConsentType
from apps.core.exceptions import ZpotAPIError

from . import services
from .models import DataPrivacyRequest, RequestStatus


class PrivacyRequestSerializer(serializers.ModelSerializer):
    download_available = serializers.SerializerMethodField()

    class Meta:
        model = DataPrivacyRequest
        fields = ["id", "reference", "kind", "status", "created_at", "completed_at", "expires_at", "download_available"]

    def get_download_available(self, o) -> bool:
        return (
            bool(o.file)
            and o.status == RequestStatus.COMPLETED
            and (o.expires_at is None or o.expires_at > timezone.now())
        )


ConsentsOut = inline_serializer("Consents", {c.value: serializers.DictField() for c in ConsentType})
ConsentsIn = inline_serializer(
    "ConsentsPatch", {c.value: serializers.BooleanField(required=False) for c in ConsentType}
)


class ConsentsView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = None

    @extend_schema(responses=ConsentsOut)
    def get(self, request):
        return Response(services.current_consents(request.user))

    @extend_schema(request=ConsentsIn, responses=ConsentsOut)
    def patch(self, request):
        valid = {c.value for c in ConsentType}
        changes = {k: v for k, v in request.data.items() if k in valid}
        if not changes or not all(isinstance(v, bool) for v in changes.values()):
            raise ZpotAPIError("Send consent types with true/false values.", code="validation_error")
        return Response(services.update_consents(request.user, changes))


class DataExportView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PrivacyRequestSerializer

    @extend_schema(request=None, responses={202: PrivacyRequestSerializer})
    def post(self, request):
        r = services.request_export(request.user)
        return Response(self.get_serializer(r).data, status=status.HTTP_202_ACCEPTED)


class DeletionRequestView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = None

    @extend_schema(
        request=inline_serializer("DeletionIn", {"confirm": serializers.CharField()}),
        responses={200: PrivacyRequestSerializer},
    )
    def post(self, request):
        r = services.request_deletion(request.user, request.data.get("confirm"))
        return Response(PrivacyRequestSerializer(r).data)


class PrivacyRequestListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PrivacyRequestSerializer
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return DataPrivacyRequest.objects.none()
        return DataPrivacyRequest.objects.filter(user=self.request.user)


class PrivacyRequestDownloadView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = None

    @extend_schema(responses={(200, "application/json"): bytes})
    def get(self, request, pk):
        r = DataPrivacyRequest.objects.filter(pk=pk, user=request.user).first()
        if r is None or not PrivacyRequestSerializer(r).data["download_available"]:
            raise ZpotAPIError("Export not available.", code="not_found", status_code=404)
        return FileResponse(
            r.file.open("rb"), content_type="application/json", as_attachment=True, filename=f"zpot-{r.reference}.json"
        )
