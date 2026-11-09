import uuid

from django.conf import settings
from django.db import models


class RequestKind(models.TextChoices):
    EXPORT = "export", "Data export"
    DELETION = "deletion", "Account deletion"


class RequestStatus(models.TextChoices):
    RECEIVED = "received", "Received"
    PROCESSING = "processing", "Processing"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    EXPIRED = "expired", "Expired"


class DataPrivacyRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=16, unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="privacy_requests"
    )
    user_email = models.EmailField(help_text="Kept so a completed erasure remains auditable.")
    kind = models.CharField(max_length=10, choices=RequestKind.choices)
    status = models.CharField(max_length=12, choices=RequestStatus.choices, default=RequestStatus.RECEIVED)
    file = models.FileField(upload_to="privacy/", blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference} {self.kind} {self.status}"
