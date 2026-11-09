from django.conf import settings
from django.db import models
from django.db.models import Q


class VerificationAnswer(models.TextChoices):
    STILL_AVAILABLE = "still_available", "Yes, still available"
    TAKEN = "taken", "No, it's taken"
    UNSURE = "unsure", "Not sure"


class ReportVerification(models.Model):
    """A driver's answer to "is this spot still available?". One answer per voter per observation."""

    observation = models.ForeignKey(
        "availability.ParkingObservation", on_delete=models.CASCADE, related_name="verifications"
    )
    voter = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    client_token = models.CharField(max_length=64, blank=True)
    answer = models.CharField(max_length=16, choices=VerificationAnswer.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["observation", "voter"], condition=Q(voter__isnull=False), name="one_vote_per_user"
            ),
            models.UniqueConstraint(
                fields=["observation", "client_token"], condition=~Q(client_token=""), name="one_vote_per_client"
            ),
        ]

    def __str__(self):
        return f"{self.answer} on observation {self.observation_id}"


class ContributorTrustEvent(models.Model):
    """Append-only reputation ledger. Karma = clamp(default + Σ delta, 0, 1). Never overrides legal rules."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trust_events")
    delta = models.FloatField()
    reason = models.CharField(max_length=40)
    report = models.ForeignKey("zpot_reports.CommunityReport", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id} {self.delta:+.2f} ({self.reason})"
