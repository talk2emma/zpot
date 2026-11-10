import uuid

from django.conf import settings
from django.db import models
from django.db.models import F, Q

from apps.core.models import TimeStampedModel


class SessionStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ENDED = "ended", "Ended by user"
    EXPIRED = "expired", "Expired (not ended by user)"
    CANCELLED = "cancelled", "Cancelled"


class ParkingSession(TimeStampedModel):
    """A user's parking stay. `planned_end_at` is the USER's plan; `restriction_deadline` is the LEGAL limit
    computed by the rule engine. They are never conflated."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="parking_sessions")
    area = models.ForeignKey("parking.ParkingArea", on_delete=models.PROTECT, related_name="sessions")
    status = models.CharField(max_length=10, choices=SessionStatus.choices, default=SessionStatus.ACTIVE)
    started_at = models.DateTimeField()
    planned_end_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    reminder_minutes = models.PositiveSmallIntegerField(default=15)
    vehicle_class = models.CharField(max_length=16, default="car")
    permit_type = models.CharField(max_length=64, blank=True)
    has_disabled_badge = models.BooleanField(default=False)
    # Snapshot of the rule evaluation for [started_at, planned_end_at) at the last (re)evaluation
    category = models.CharField(max_length=20)
    legal_status = models.CharField(max_length=20)
    restriction_deadline = models.DateTimeField(null=True, blank=True)
    restriction_reason = models.CharField(max_length=200, blank=True)
    expected_cost = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    evaluated_at = models.DateTimeField()
    evaluation = models.JSONField(default=dict)
    # End-of-session feedback
    cost_paid = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    outcome = models.CharField(
        max_length=12, blank=True, choices=[("easy", "Easy"), ("ok", "OK"), ("hard", "Hard to find")]
    )
    shared_departure = models.BooleanField(default=False)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "planned_end_at"]),
            models.Index(fields=["user", "-started_at"], name="session_user_started"),
            models.Index(fields=["ended_at"], name="session_ended_at"),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(planned_end_at__gt=F("started_at")), name="session_plan_after_start"),
            models.CheckConstraint(
                condition=Q(ended_at__isnull=True) | Q(ended_at__gte=F("started_at")), name="session_end_after_start"
            ),
            models.CheckConstraint(
                condition=~Q(status__in=["ended", "expired"]) | Q(ended_at__isnull=False), name="session_closed_has_end"
            ),
            models.CheckConstraint(
                condition=Q(cost_paid__isnull=True) | Q(cost_paid__gte=0), name="session_cost_non_negative"
            ),
            models.UniqueConstraint(fields=["user"], condition=Q(status="active"), name="one_active_session_per_user"),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.area_id} [{self.status}]"


class ParkingSessionEvent(models.Model):
    session = models.ForeignKey(ParkingSession, on_delete=models.CASCADE, related_name="events")
    kind = models.CharField(
        max_length=24
    )  # started, edited, reevaluated, reminder_sent, deadline_changed, ended, expired
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.session_id} {self.kind}"


class ReminderKind(models.TextChoices):
    PLANNED_DEPARTURE = "planned_departure", "Before planned departure"
    RESTRICTION_DEADLINE = "restriction_deadline", "Before a legal restriction starts"
    CUSTOM = "custom", "Custom"


class ReminderStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    SENT = "sent", "Sent"
    CANCELLED = "cancelled", "Cancelled"
    FAILED = "failed", "Failed"


class ParkingReminder(models.Model):
    session = models.ForeignKey(ParkingSession, on_delete=models.CASCADE, related_name="reminders")
    kind = models.CharField(max_length=24, choices=ReminderKind.choices)
    minutes_before = models.PositiveSmallIntegerField()
    fire_at = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=10, choices=ReminderStatus.choices, default=ReminderStatus.SCHEDULED)
    sent_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=240, blank=True)
    notification = models.ForeignKey(
        "zpot_notifications.Notification", null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["fire_at"]
        indexes = [models.Index(fields=["status", "fire_at"])]
        constraints = [models.CheckConstraint(condition=Q(minutes_before__lte=240), name="reminder_minutes_range")]

    def __str__(self):
        return f"{self.kind} at {self.fire_at} [{self.status}]"
