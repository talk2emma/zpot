from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import ZpotAPIError
from apps.core.features import FeatureGateMixin
from apps.core.permissions import client_token

from . import services
from .models import ParkingReminder, ParkingSession, ReminderKind, ReminderStatus, SessionStatus
from .serializers import (
    AddReminderSerializer,
    EndSessionSerializer,
    ReminderSerializer,
    SessionDetailSerializer,
    SessionSerializer,
    SessionSummarySerializer,
    StartSessionSerializer,
    UpdateSessionSerializer,
)

SessionWithWarnings = inline_serializer(
    "SessionWithWarnings",
    {"session": SessionDetailSerializer(), "warnings": serializers.ListField(child=serializers.DictField())},
)


def _qs(user):
    return ParkingSession.objects.filter(user=user).select_related("area", "area__city").prefetch_related("reminders")


class SessionListCreateView(FeatureGateMixin, ListAPIView):
    feature_flag = "parking_sessions"
    cursor_ordering = ("-started_at", "-id")
    permission_classes = [IsAuthenticated]
    serializer_class = SessionSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation
            return ParkingSession.objects.none()
        services.expire_stale(user=self.request.user)
        qs = _qs(self.request.user)
        st = self.request.query_params.get("status")
        return qs.filter(status=st) if st else qs

    @extend_schema(request=StartSessionSerializer, responses={201: SessionWithWarnings})
    def post(self, request):
        s = StartSessionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        session, warnings = services.start_session(request.user, **s.validated_data)
        session = _qs(request.user).prefetch_related("events").get(pk=session.pk)
        return Response({"session": SessionDetailSerializer(session).data, "warnings": warnings}, status=201)


class ActiveSessionView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SessionDetailSerializer

    @extend_schema(responses={200: SessionDetailSerializer, 204: None})
    def get(self, request):
        services.expire_stale(user=request.user)
        s = _qs(request.user).prefetch_related("events").filter(status=SessionStatus.ACTIVE).first()
        if s is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(self.get_serializer(s).data)


class SessionDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SessionDetailSerializer

    def _get(self, request, pk):
        s = _qs(request.user).prefetch_related("events").filter(pk=pk).first()
        if s is None:
            raise ZpotAPIError("Session not found.", code="not_found", status_code=404)
        return s

    def get(self, request, pk):
        return Response(self.get_serializer(self._get(request, pk)).data)

    @extend_schema(request=UpdateSessionSerializer, responses=SessionWithWarnings)
    def patch(self, request, pk):
        s = UpdateSessionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        session, warnings = services.update_session(request.user, pk, **s.validated_data)
        return Response({"session": SessionDetailSerializer(self._get(request, session.pk)).data, "warnings": warnings})


class SessionEndView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EndSessionSerializer

    @extend_schema(
        responses=inline_serializer(
            "EndSessionResponse",
            {
                "session": SessionDetailSerializer(),
                "already_ended": serializers.BooleanField(),
                "summary": SessionSummarySerializer(),
            },
        )
    )
    def post(self, request, pk):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        session, already = services.end_session(
            request.user, pk, client_token=client_token(request), **s.validated_data
        )
        session = _qs(request.user).prefetch_related("events").get(pk=session.pk)
        return Response(
            {
                "session": SessionDetailSerializer(session).data,
                "already_ended": already,
                "summary": SessionSummarySerializer(services.summary(session)).data,
            }
        )


class SessionSummaryView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SessionSummarySerializer

    def get(self, request, pk):
        s = _qs(request.user).filter(pk=pk).first()
        if s is None:
            raise ZpotAPIError("Session not found.", code="not_found", status_code=404)
        return Response(self.get_serializer(services.summary(s)).data)


class SessionRemindersView(FeatureGateMixin, GenericAPIView):
    feature_flag = "parking_sessions"
    permission_classes = [IsAuthenticated]
    serializer_class = ReminderSerializer

    def _session(self, request, pk):
        s = _qs(request.user).filter(pk=pk).first()
        if s is None:
            raise ZpotAPIError("Session not found.", code="not_found", status_code=404)
        return s

    def get(self, request, pk):
        return Response(self.get_serializer(self._session(request, pk).reminders.all(), many=True).data)

    @extend_schema(request=AddReminderSerializer, responses={201: ReminderSerializer})
    def post(self, request, pk):
        s = self._session(request, pk)
        if s.status != SessionStatus.ACTIVE:
            raise ZpotAPIError("This session has ended.", code="session_not_active", status_code=409)
        body = AddReminderSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        m = body.validated_data["minutes_before"]
        fire = s.planned_end_at - timedelta(minutes=m)
        if fire <= timezone.now():
            raise ZpotAPIError("That reminder time has already passed.", code="reminder_in_past", status_code=400)
        r, created = ParkingReminder.objects.get_or_create(
            session=s,
            kind=ReminderKind.CUSTOM,
            minutes_before=m,
            status=ReminderStatus.SCHEDULED,
            defaults={"fire_at": fire},
        )
        return Response(self.get_serializer(r).data, status=201 if created else 200)


class SessionReminderDeleteView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReminderSerializer

    def delete(self, request, pk, reminder_id):
        r = ParkingReminder.objects.filter(pk=reminder_id, session__pk=pk, session__user=request.user).first()
        if r is None:
            raise ZpotAPIError("Reminder not found.", code="not_found", status_code=404)
        if r.status == ReminderStatus.SCHEDULED:
            r.status = ReminderStatus.CANCELLED
            r.save(update_fields=["status"])
        return Response(status=status.HTTP_204_NO_CONTENT)
