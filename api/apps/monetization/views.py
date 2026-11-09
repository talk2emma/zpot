from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .entitlements import entitlement_for

EntitlementSerializer = inline_serializer(
    "Entitlement",
    {
        "plan": serializers.ChoiceField(choices=["free", "pro"]),
        "status": serializers.ChoiceField(choices=["none", "trial", "active", "cancelled", "expired"]),
        "provider": serializers.CharField(allow_null=True),
        "purchases_available": serializers.BooleanField(),
        "pro_preview_enabled": serializers.BooleanField(),
        "limits": serializers.DictField(),
        "note": serializers.CharField(),
    },
)


class EntitlementView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = None

    @extend_schema(responses={200: EntitlementSerializer})
    def get(self, request):
        return Response(entitlement_for(request.user))
