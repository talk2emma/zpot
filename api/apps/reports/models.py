import uuid

from django.conf import settings
from django.contrib.gis.db import models

from apps.core.models import TimeStampedModel


class ReportType(models.TextChoices):
    LEAVING = "leaving", "I'm leaving this parking spot"
    FOUND = "found", "I found an available spot"
    OCCUPIED = "occupied", "This spot is occupied or unavailable"
    INCORRECT_RULE = "incorrect_rule", "Parking information is incorrect"
    NEW_SIGN = "new_sign", "A new sign or restriction exists"
    CLOSURE = "closure", "Temporary closure"
    OBSTRUCTION = "obstruction", "Obstruction"
    WRONG_LOCATION = "wrong_location", "Incorrect map location"
    OTHER = "other", "Another parking issue"


EPHEMERAL_TYPES = {ReportType.LEAVING, ReportType.FOUND, ReportType.OCCUPIED}
GUEST_ALLOWED_TYPES = EPHEMERAL_TYPES


class ReportStatus(models.TextChoices):
    PUBLISHED = "published", "Published (temporary)"
    PENDING_REVIEW = "pending_review", "Pending review"
    UNDER_REVIEW = "under_review", "Under review"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    SUPERSEDED = "superseded", "Superseded"
    EXPIRED = "expired", "Expired"
    APPEAL_REVIEW = "appeal_review", "Appeal in review"
    DUPLICATE = "duplicate", "Duplicate"


class CommunityReport(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=16, unique=True)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reports"
    )
    client_token = models.CharField(max_length=64, blank=True, db_index=True, help_text="Guest install token (opaque)")
    type = models.CharField(max_length=20, choices=ReportType.choices)
    area = models.ForeignKey(
        "parking.ParkingArea", null=True, blank=True, on_delete=models.SET_NULL, related_name="reports"
    )
    location = models.PointField(srid=4326, geography=True)
    scope = models.CharField(
        max_length=10, choices=[("spot", "One parking position"), ("segment", "Street section")], default="spot"
    )
    details = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True, max_length=1000)
    status = models.CharField(max_length=16, choices=ReportStatus.choices)
    trust_score = models.FloatField(default=0)
    trust_explanation = models.JSONField(default=dict, blank=True)
    rejection_reason = models.CharField(max_length=300, blank=True)
    observation = models.OneToOneField(
        "availability.ParkingObservation", null=True, blank=True, on_delete=models.SET_NULL, related_name="report"
    )
    duplicate_of = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "type"]), models.Index(fields=["reporter", "-created_at"])]

    def __str__(self):
        return f"{self.reference} {self.type}"

    @property
    def is_ephemeral(self):
        return self.type in EPHEMERAL_TYPES


class ReportAttachment(models.Model):
    report = models.ForeignKey(CommunityReport, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="reports/%Y/%m/")
    content_type = models.CharField(max_length=40)
    size = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    metadata_stripped = models.BooleanField(default=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class ModerationDecision(models.TextChoices):
    START_REVIEW = "start_review", "Start review"
    ACCEPT = "accept", "Accept"
    REJECT = "reject", "Reject"
    DUPLICATE = "duplicate", "Mark duplicate"
    ESCALATE_TO_SCOUT = "escalate_to_scout", "Send a scout"


class ReportModeration(models.Model):
    report = models.ForeignKey(CommunityReport, on_delete=models.CASCADE, related_name="moderations")
    moderator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    decision = models.CharField(max_length=20, choices=ModerationDecision.choices)
    reason = models.CharField(max_length=300, blank=True)
    from_status = models.CharField(max_length=16)
    to_status = models.CharField(max_length=16)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class AppealStatus(models.TextChoices):
    OPEN = "open", "Open"
    UPHELD = "upheld", "Upheld (report accepted)"
    DISMISSED = "dismissed", "Dismissed"


class ReportAppeal(models.Model):
    report = models.OneToOneField(CommunityReport, on_delete=models.CASCADE, related_name="appeal")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField(max_length=1000)
    status = models.CharField(max_length=10, choices=AppealStatus.choices, default=AppealStatus.OPEN)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
