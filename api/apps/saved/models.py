from django.conf import settings
from django.contrib.gis.db import models


class SavedParkingLocation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_locations")
    area = models.ForeignKey("parking.ParkingArea", on_delete=models.CASCADE, related_name="saved_by")
    label = models.CharField(max_length=80)
    category_at_save = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "area"], name="saved_location_unique")]


class SavedDestination(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_destinations")
    label = models.CharField(max_length=80)
    place_ref = models.CharField(max_length=80, blank=True)
    name = models.CharField(max_length=160)
    subtitle = models.CharField(max_length=200, blank=True)
    location = models.PointField(srid=4326, geography=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "label"], name="saved_destination_label_unique")]


class SearchHistory(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="search_history")
    place_ref = models.CharField(max_length=80, blank=True)
    name = models.CharField(max_length=160)
    subtitle = models.CharField(max_length=200, blank=True)
    location = models.PointField(srid=4326, geography=True)
    searched_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ["-searched_at"]
        constraints = [models.UniqueConstraint(fields=["user", "place_ref", "name"], name="search_history_unique")]
