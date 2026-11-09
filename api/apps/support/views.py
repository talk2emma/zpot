from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView, ListAPIView, RetrieveAPIView
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.exceptions import ZpotAPIError
from apps.core.uploads import sanitise_image

from . import services
from .models import HelpArticle, SupportAttachment, SupportTicket
from .serializers import CreateTicketSerializer, HelpArticleSerializer, TicketSerializer


class HelpArticleListView(ListAPIView):
    serializer_class = HelpArticleSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = None

    def get_queryset(self):
        qs = HelpArticle.objects.filter(published=True)
        cat = self.request.query_params.get("category")
        return qs.filter(category=cat) if cat else qs


class HelpArticleDetailView(RetrieveAPIView):
    serializer_class = HelpArticleSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    queryset = HelpArticle.objects.filter(published=True)


class TicketListCreateView(ListAPIView):
    serializer_class = TicketSerializer
    throttle_scope = "support"

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "POST" else [IsAuthenticated()]

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.request.method == "POST" else super().get_throttles()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return SupportTicket.objects.none()
        return SupportTicket.objects.filter(user=self.request.user)

    @extend_schema(request=CreateTicketSerializer, responses={201: TicketSerializer})
    def post(self, request):
        s = CreateTicketSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        t = services.create_ticket(user=request.user, **s.validated_data)
        return Response(TicketSerializer(t).data, status=status.HTTP_201_CREATED)


class TicketDetailView(RetrieveAPIView):
    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user)


class TicketAttachmentView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    serializer_class = None
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "uploads"

    @extend_schema(
        request={"multipart/form-data": inline_serializer("SupportUpload", {"file": serializers.ImageField()})},
        responses={201: inline_serializer("SupportAttachmentOut", {"id": serializers.IntegerField()})},
    )
    def post(self, request, pk):
        t = SupportTicket.objects.filter(pk=pk, user=request.user).first()
        if t is None:
            raise ZpotAPIError("Ticket not found.", code="not_found", status_code=404)
        if t.attachments.count() >= 3:
            raise ZpotAPIError("Up to 3 screenshots per ticket.", code="too_many_attachments", status_code=409)
        f, meta = sanitise_image(request.FILES.get("file"))
        a = SupportAttachment(ticket=t, **meta)
        a.file.save(f.name, f, save=True)
        return Response({"id": a.id}, status=status.HTTP_201_CREATED)
