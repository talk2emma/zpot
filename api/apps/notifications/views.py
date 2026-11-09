from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView, ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import DeviceRegistration
from apps.core.exceptions import ZpotAPIError

from .models import Notification
from .serializers import DeviceSerializer, NotificationPreferenceSerializer, NotificationSerializer
from .services import prefs_for


class NotificationListView(ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return Notification.objects.none()
        qs = Notification.objects.filter(user=self.request.user).order_by("-created_at")
        if self.request.query_params.get("unread") in ("1", "true"):
            qs = qs.filter(read_at__isnull=True)
        return qs

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        resp.data["unread_count"] = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return resp


class NotificationDetailView(RetrieveAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationReadView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def post(self, request, pk):
        n = Notification.objects.filter(user=request.user, pk=pk).first()
        if n is None:
            raise ZpotAPIError("Notification not found.", code="not_found", status_code=404)
        if n.read_at is None:
            n.read_at = timezone.now()
            n.save(update_fields=["read_at"])
        return Response(NotificationSerializer(n).data)


class NotificationReadAllView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = None

    @extend_schema(request=None, responses=inline_serializer("ReadAll", {"updated": serializers.IntegerField()}))
    def post(self, request):
        n = Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response({"updated": n})


class NotificationPreferencesView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationPreferenceSerializer

    def get(self, request):
        return Response(self.get_serializer(prefs_for(request.user)).data)

    def patch(self, request):
        s = self.get_serializer(prefs_for(request.user), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class DeviceListCreateView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DeviceSerializer

    def get(self, request):
        return Response(self.get_serializer(request.user.devices.all(), many=True).data)

    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        dev, created = DeviceRegistration.objects.update_or_create(
            platform=d["platform"],
            push_token=d["push_token"],
            defaults={
                "user": request.user,
                "app_version": d.get("app_version", ""),
                "is_active": True,
                "last_seen_at": timezone.now(),
            },
        )
        return Response(
            self.get_serializer(dev).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class DeviceDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DeviceSerializer

    def delete(self, request, pk):
        n, _ = request.user.devices.filter(pk=pk).delete()
        if not n:
            raise ZpotAPIError("Device not found.", code="not_found", status_code=404)
        return Response(status=status.HTTP_204_NO_CONTENT)
