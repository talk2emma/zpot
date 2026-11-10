from django.contrib.gis.geos import Point
from django.db import transaction
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import ZpotAPIError
from apps.regulations.services.engine import evaluate
from apps.regulations.services.specs import area_spec

from .models import SavedDestination, SavedParkingLocation, SearchHistory
from .serializers import (
    CreateSavedLocationSerializer,
    ImportSerializer,
    RenameSerializer,
    SavedDestinationSerializer,
    SavedLocationSerializer,
    SearchHistorySerializer,
)


def _locations(user):
    from apps.regulations.services.specs import REGULATION_PREFETCH

    return (
        SavedParkingLocation.objects.filter(user=user)
        .select_related("area", "area__city", "user__preferences")
        .prefetch_related(*[f"area__{p}" for p in REGULATION_PREFETCH])
    )


def _save(user, area_id, label):
    from django.utils import timezone

    from apps.parking.selectors import areas_with_regulations

    area = areas_with_regulations().filter(pk=area_id, is_active=True).first()
    if area is None:
        raise ZpotAPIError("Parking area not found.", code="not_found", status_code=404)
    cat = evaluate(area_spec(area), timezone.now(), 120).category.value
    obj, created = SavedParkingLocation.objects.get_or_create(
        user=user, area=area, defaults={"label": (label or area.name)[:80], "category_at_save": cat}
    )
    return obj, created


class SavedLocationsView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedLocationSerializer

    def get(self, request):
        return Response(self.get_serializer(_locations(request.user), many=True).data)

    @extend_schema(request=CreateSavedLocationSerializer, responses={201: SavedLocationSerializer})
    def post(self, request):
        s = CreateSavedLocationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        obj, created = _save(request.user, s.validated_data["area_id"], s.validated_data.get("label"))
        return Response(
            self.get_serializer(_locations(request.user).get(pk=obj.pk)).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class SavedLocationImportView(GenericAPIView):
    """Transfers guest (device-only) saved places into the account after sign-up/sign-in. Idempotent."""

    permission_classes = [IsAuthenticated]
    serializer_class = ImportSerializer

    @extend_schema(
        responses=inline_serializer(
            "ImportResult", {"imported": serializers.IntegerField(), "already_saved": serializers.IntegerField()}
        )
    )
    @transaction.atomic
    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        imported = existing = 0
        for it in s.validated_data["items"][:100]:
            try:
                _, created = _save(request.user, it["area_id"], it.get("label"))
            except ZpotAPIError:  # area removed since the guest saved it: skip it, keep the rest
                continue
            imported += created
            existing += not created
        return Response({"imported": imported, "already_saved": existing})


class SavedLocationDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedLocationSerializer

    def _get(self, request, pk):
        o = _locations(request.user).filter(pk=pk).first()
        if o is None:
            raise ZpotAPIError("Saved location not found.", code="not_found", status_code=404)
        return o

    @extend_schema(request=RenameSerializer)
    def patch(self, request, pk):
        o = self._get(request, pk)
        s = RenameSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        o.label = s.validated_data["label"]
        o.save(update_fields=["label", "updated_at"])
        return Response(self.get_serializer(o).data)

    def delete(self, request, pk):
        self._get(request, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SavedDestinationsView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedDestinationSerializer

    def get(self, request):
        return Response(self.get_serializer(request.user.saved_destinations.all(), many=True).data)

    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        pt = Point(d.pop("longitude"), d.pop("latitude"), srid=4326)
        if request.user.saved_destinations.filter(label__iexact=d["label"]).exists():
            raise ZpotAPIError(
                "You already have a saved destination with that name.", code="duplicate_label", status_code=409
            )
        obj = SavedDestination.objects.create(user=request.user, location=pt, **d)
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)


class SavedDestinationDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedDestinationSerializer

    def delete(self, request, pk):
        n, _ = request.user.saved_destinations.filter(pk=pk).delete()
        if not n:
            raise ZpotAPIError("Saved destination not found.", code="not_found", status_code=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecentSearchesView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SearchHistorySerializer

    def get(self, request):
        return Response(self.get_serializer(request.user.search_history.all()[:10], many=True).data)

    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        pt = Point(d.pop("longitude"), d.pop("latitude"), srid=4326)
        obj, _ = SearchHistory.objects.update_or_create(
            user=request.user,
            place_ref=d.get("place_ref", ""),
            name=d["name"],
            defaults={"subtitle": d.get("subtitle", ""), "location": pt},
        )
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)

    def delete(self, request):
        request.user.search_history.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
