"""Short-lived availability signals. Never evidence of legality; never a guaranteed vacancy."""

from django.conf import settings
from django.contrib.gis.db import models
from django.db.models import F, Q


class ObservationKind(models.TextChoices):
    AVAILABLE = "available", "Reported available"
    LEAVING = "leaving", "Driver leaving"
    OCCUPIED = "occupied", "Reported occupied"


class AvailabilityState(models.TextChoices):
    UNKNOWN = "unknown", "Unknown"
    RECENTLY_AVAILABLE = "recently_reported_available", "Recently reported available"
    RECENTLY_OCCUPIED = "reported_occupied", "Recently reported occupied"
    CONFLICTING = "conflicting_reports", "Conflicting reports"
    EXPIRED = "observation_expired", "Observation expired"
    PREDICTION_UNAVAILABLE = "prediction_unavailable", "Prediction unavailable"
    PREDICTED = "supported_prediction", "Supported prediction (validated model)"


class ParkingObservation(models.Model):
    area = models.ForeignKey(
        "parking.ParkingArea", null=True, blank=True, on_delete=models.CASCADE, related_name="observations"
    )
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    kind = models.CharField(max_length=12, choices=ObservationKind.choices)
    location = models.PointField(srid=4326, geography=True)
    observed_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    confirmations = models.PositiveSmallIntegerField(default=1)
    contradictions = models.PositiveSmallIntegerField(default=0)
    trust_score = models.FloatField(default=0.5)
    needs_review = models.BooleanField(default=False)

    class Meta:
        ordering = ["-observed_at"]
        indexes = [models.Index(fields=["area", "expires_at"]), models.Index(fields=["expires_at"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(expires_at__gt=F("observed_at")), name="observation_expiry_after_observed"
            )
        ]

    def __str__(self):
        return f"{self.kind} @ area {self.area_id}"
