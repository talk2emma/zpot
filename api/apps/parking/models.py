from django.contrib.gis.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel


class SourceKind(models.TextChoices):
    OFFICIAL_OPEN_DATA = "official_open_data", "Official open data"
    OPERATOR = "operator", "Car-park operator"
    COMMUNITY = "community", "Community-confirmed"
    SCOUT = "scout", "Scout visit"
    DEVELOPMENT_FIXTURE = "development_fixture", "Development fixture (not real data)"


class ParkingDataSource(TimeStampedModel):
    name = models.CharField(max_length=160, unique=True)
    kind = models.CharField(max_length=24, choices=SourceKind.choices)
    url = models.URLField(blank=True)
    licence = models.CharField(max_length=120, blank=True)
    attribution = models.CharField(max_length=240, blank=True)
    is_development_fixture = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class StreetSegment(TimeStampedModel):
    city = models.ForeignKey("cities.City", on_delete=models.CASCADE, related_name="street_segments")
    street_name = models.CharField(max_length=160)
    geometry = models.LineStringField(srid=4326)

    def __str__(self):
        return self.street_name


class AreaKind(models.TextChoices):
    ON_STREET = "on_street", "On-street parking"
    CAR_PARK = "car_park", "Car park"
    BAY = "bay", "Designated bay"


class VerificationStatus(models.TextChoices):
    VERIFIED = "verified", "Verified against an official source"
    COMMUNITY = "community", "Community-confirmed"
    UNVERIFIED = "unverified", "Not verified"


class EvidenceStatus(models.TextChoices):
    OFFICIAL_RECORD = "official_record_matched", "Official record matched"
    SIGN_PHOTO = "driver_sign_photo", "Driver photo of sign"
    OPERATOR_TARIFF = "operator_tariff", "Operator tariff page"
    NONE = "none", "No evidence yet"


class ParkingArea(TimeStampedModel):
    """A place where a parking decision is made: a street section, a car park or a single bay."""

    city = models.ForeignKey("cities.City", on_delete=models.PROTECT, related_name="parking_areas")
    supported_area = models.ForeignKey(
        "cities.SupportedArea", null=True, blank=True, on_delete=models.SET_NULL, related_name="parking_areas"
    )
    street_segment = models.ForeignKey(StreetSegment, null=True, blank=True, on_delete=models.SET_NULL)
    external_ref = models.CharField(max_length=64, unique=True, help_text="Stable id from the source dataset.")
    name = models.CharField(max_length=160)
    address = models.CharField(max_length=240, blank=True)
    kind = models.CharField(max_length=12, choices=AreaKind.choices, default=AreaKind.ON_STREET)
    location = models.PointField(srid=4326, geography=True, help_text="Representative point (entrance/midpoint).")
    geometry = models.GeometryField(srid=4326, null=True, blank=True, help_text="Line (street) or polygon (car park).")
    capacity_estimate = models.PositiveIntegerField(null=True, blank=True)
    is_accessible = models.BooleanField(default=False)
    verification_status = models.CharField(
        max_length=12, choices=VerificationStatus.choices, default=VerificationStatus.UNVERIFIED
    )
    evidence_status = models.CharField(max_length=32, choices=EvidenceStatus.choices, default=EvidenceStatus.NONE)
    verified_at = models.DateTimeField(null=True, blank=True)
    data_source = models.ForeignKey(ParkingDataSource, null=True, blank=True, on_delete=models.PROTECT)
    operator_name = models.CharField(max_length=120, blank=True)
    # Commercial metadata. Ranking code MUST NOT read these fields (see tests/test_ranking_neutrality).
    is_commercial_partner = models.BooleanField(default=False)
    partner_offer = models.CharField(max_length=300, blank=True)
    ev_charging_note = models.CharField(max_length=160, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["city", "is_active"])]
        constraints = [
            models.CheckConstraint(
                condition=~Q(verification_status="verified") | Q(verified_at__isnull=False),
                name="area_verified_needs_date",
            ),
        ]

    def __str__(self):
        return self.name


class EvidenceKind(models.TextChoices):
    OFFICIAL_RECORD = "official_record", "Official record"
    SIGN_PHOTO = "sign_photo", "Sign photo"
    OPERATOR_TARIFF = "operator_tariff", "Operator tariff"
    SCOUT_VISIT = "scout_visit", "Scout visit"


class ParkingEvidence(TimeStampedModel):
    area = models.ForeignKey(ParkingArea, on_delete=models.CASCADE, related_name="evidence")
    kind = models.CharField(max_length=20, choices=EvidenceKind.choices)
    source = models.ForeignKey(ParkingDataSource, on_delete=models.PROTECT)
    description = models.CharField(max_length=300)
    captured_at = models.DateTimeField()
    url = models.URLField(blank=True)

    class Meta:
        ordering = ["-captured_at"]


class ParkingDataRevision(models.Model):
    """Append-only history of changes to trusted rule data (written by regulations.signals)."""

    area = models.ForeignKey(ParkingArea, on_delete=models.CASCADE, related_name="revisions")
    object_type = models.CharField(max_length=40)
    object_id = models.BigIntegerField()
    action = models.CharField(max_length=10)
    snapshot = models.JSONField(default=dict)
    changed_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
