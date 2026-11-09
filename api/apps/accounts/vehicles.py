from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import ZpotAPIError
from apps.monetization.entitlements import limit
from apps.regulations.models import PermitType

from .models import UserPreference, Vehicle, VehicleClass


class VehicleSerializer(serializers.ModelSerializer):
    permit_type = serializers.SlugRelatedField(
        slug_field="code", queryset=PermitType.objects.all(), allow_null=True, required=False
    )
    permit_name = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = ["id", "label", "vehicle_class", "permit_type", "permit_name", "is_active", "created_at"]
        read_only_fields = ["is_active", "created_at"]

    def get_permit_name(self, o) -> str | None:
        return o.permit_type.name if o.permit_type_id else None


def _sync_prefs(user, v):
    prefs, _ = UserPreference.objects.get_or_create(user=user)
    prefs.vehicle_class = v.vehicle_class if v else VehicleClass.CAR
    prefs.permit_type = v.permit_type if v else None
    prefs.save(update_fields=["vehicle_class", "permit_type"])


@transaction.atomic
def activate(user, v):
    Vehicle.objects.filter(user=user, is_active=True).exclude(pk=v.pk).update(is_active=False)
    if not v.is_active:
        v.is_active = True
        v.save(update_fields=["is_active"])
    _sync_prefs(user, v)


def ensure_default(user):
    """The first vehicle mirrors the existing preferences, so nothing changes for the driver."""
    if not Vehicle.objects.filter(user=user).exists():
        prefs, _ = UserPreference.objects.get_or_create(user=user)
        Vehicle.objects.create(
            user=user, label="My car", vehicle_class=prefs.vehicle_class, permit_type=prefs.permit_type, is_active=True
        )


class VehicleListView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VehicleSerializer

    def get_queryset(self):
        return Vehicle.objects.filter(user=self.request.user).select_related("permit_type")

    @extend_schema(responses={200: VehicleSerializer(many=True)})
    def get(self, request):
        ensure_default(request.user)
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    @extend_schema(responses={201: VehicleSerializer})
    def post(self, request):
        ensure_default(request.user)
        if self.get_queryset().count() >= limit(request.user, "vehicles"):
            raise ZpotAPIError(
                "Free accounts have one vehicle. Edit it, or remove it first.",
                code="plan_limit",
                status_code=403,
                details={"limit": limit(request.user, "vehicles")},
            )
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.save(user=request.user)
        return Response(self.get_serializer(v).data, status=status.HTTP_201_CREATED)


class VehicleDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VehicleSerializer

    def _get(self, request, pk):
        v = Vehicle.objects.filter(user=request.user, pk=pk).first()
        if v is None:
            raise ZpotAPIError("Vehicle not found.", code="not_found", status_code=404)
        return v

    @extend_schema(responses={200: VehicleSerializer})
    def patch(self, request, pk):
        v = self._get(request, pk)
        s = self.get_serializer(v, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        v = s.save()
        if v.is_active:
            _sync_prefs(request.user, v)
        return Response(self.get_serializer(v).data)

    @extend_schema(responses={204: None})
    @transaction.atomic
    def delete(self, request, pk):
        v = self._get(request, pk)
        was_active = v.is_active
        v.delete()
        if was_active:
            nxt = Vehicle.objects.filter(user=request.user).first()
            if nxt:
                activate(request.user, nxt)
            else:
                _sync_prefs(request.user, None)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VehicleActivateView(GenericAPIView):
    """POST only (must not inherit PATCH/DELETE from the detail view)."""

    permission_classes = [IsAuthenticated]
    serializer_class = VehicleSerializer

    @extend_schema(request=None, responses={200: VehicleSerializer})
    def post(self, request, pk):
        v = Vehicle.objects.filter(user=request.user, pk=pk).first()
        if v is None:
            raise ZpotAPIError("Vehicle not found.", code="not_found", status_code=404)
        activate(request.user, v)
        return Response(self.get_serializer(v).data)
