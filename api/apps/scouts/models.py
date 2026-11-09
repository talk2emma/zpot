from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class AssignmentStatus(models.TextChoices):
    ASSIGNED = "assigned", "Assigned"
    SUBMITTED = "submitted", "Submitted — pending review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class ScoutAssignment(TimeStampedModel):
    area = models.ForeignKey("parking.ParkingArea", on_delete=models.CASCADE, related_name="scout_assignments")
    report = models.OneToOneField(
        "zpot_reports.CommunityReport",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="scout_assignment",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="scout_assignments"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    reason = models.CharField(max_length=200)
    status = models.CharField(max_length=10, choices=AssignmentStatus.choices, default=AssignmentStatus.ASSIGNED)
    due_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["status", "-created_at"]

    def __str__(self):
        return f"Scout {self.area} [{self.status}]"


class Outcome(models.TextChoices):
    MATCHES = "matches", "Matches what Zpot shows"
    DIFFERS = "differs", "Differs from Zpot"
    NO_ACCESS = "no_access", "Couldn't access"


class ScoutSubmission(models.Model):
    assignment = models.ForeignKey(ScoutAssignment, on_delete=models.CASCADE, related_name="submissions")
    scout = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    outcome = models.CharField(max_length=10, choices=Outcome.choices)
    observed_rules = models.TextField(blank=True, max_length=2000)
    notes = models.TextField(blank=True, max_length=2000)
    submitted_at = models.DateTimeField(auto_now_add=True)
    review_status = models.CharField(
        max_length=10,
        choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")],
        default="pending",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.assignment_id}: {self.outcome} [{self.review_status}]"


class ScoutPhoto(models.Model):
    submission = models.ForeignKey(ScoutSubmission, on_delete=models.CASCADE, related_name="photos")
    file = models.FileField(upload_to="scouts/%Y/%m/")
    content_type = models.CharField(max_length=40)
    size = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"photo {self.id} for submission {self.submission_id}"
