from django.contrib.gis.db import models
from django.contrib.postgres.indexes import GinIndex, OpClass
from django.db.models.functions import Upper

from apps.core.models import TimeStampedModel


class City(TimeStampedModel):
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=120)
    country_code = models.CharField(max_length=2)
    timezone = models.CharField(max_length=64, default="Europe/Lisbon")
    currency = models.CharField(max_length=3, default="EUR")
    center = models.PointField(srid=4326)
    boundary = models.MultiPolygonField(srid=4326, null=True, blank=True)
    is_supported = models.BooleanField(default=False, help_text="Parking guidance available in this city.")
    launch_note = models.CharField(max_length=240, blank=True)

    class Meta:
        verbose_name_plural = "cities"
        ordering = ["name"]

    def __str__(self):
        return self.name


class CoverageLevel(models.TextChoices):
    FULL = "full", "Verified coverage"
    PARTIAL = "partial", "Partial coverage"
    MAPPING = "mapping", "Being mapped"


class SupportedArea(TimeStampedModel):
    """A neighbourhood within a city with a declared data-coverage level."""

    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="areas")
    slug = models.SlugField(max_length=64)
    name = models.CharField(max_length=120)
    boundary = models.MultiPolygonField(srid=4326)
    coverage = models.CharField(max_length=10, choices=CoverageLevel.choices, default=CoverageLevel.PARTIAL)
    coverage_note = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["city", "slug"], name="supported_area_city_slug_unique")]

    def __str__(self):
        return f"{self.name} ({self.city.slug})"


class PlaceKind(models.TextChoices):
    LANDMARK = "landmark", "Landmark"
    NEIGHBOURHOOD = "neighbourhood", "Neighbourhood"
    ADDRESS = "address", "Address"
    CITY = "city", "City"


class Place(TimeStampedModel):
    """Development gazetteer used by the local geocoding provider."""

    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="places")
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    subtitle = models.CharField(max_length=200, blank=True)
    kind = models.CharField(max_length=16, choices=PlaceKind.choices, default=PlaceKind.LANDMARK)
    location = models.PointField(srid=4326, geography=True)
    popularity = models.PositiveIntegerField(default=0)
    is_popular = models.BooleanField(default=False)

    class Meta:
        ordering = ["-popularity", "name"]
        indexes = [GinIndex(OpClass(Upper("name"), name="gin_trgm_ops"), name="place_name_trgm")]

    def __str__(self):
        return self.name
