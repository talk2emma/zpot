import uuid

from django.conf import settings
from django.contrib.gis.db import models


class ParkEventStatus(models.TextChoices):
    DETECTED = "detected", "Possible parking event"
    CONFIRMED = "confirmed", "Confirmed by user"
    DISMISSED = "dismissed", "Dismissed by user"


class ParkingEvent(models.Model):
    """EXPERIMENTAL (Z-Trigger). Private to the user; never creates a public vacancy observation."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="parking_events")
    source = models.CharField(max_length=24, default="bluetooth_disconnect")
    location = models.PointField(srid=4326, geography=True)
    accuracy_m = models.FloatField(null=True, blank=True)
    detected_at = models.DateTimeField()
    status = models.CharField(max_length=10, choices=ParkEventStatus.choices, default=ParkEventStatus.DETECTED)
    area = models.ForeignKey("parking.ParkingArea", null=True, blank=True, on_delete=models.SET_NULL)
    session = models.ForeignKey("zpot_sessions.ParkingSession", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-detected_at"]
