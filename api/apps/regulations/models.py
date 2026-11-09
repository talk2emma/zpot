"""Parking regulation model.

Legality is never a Boolean. We separately model:
  * permission  — ParkingRule(kind=free|paid|permit_only|badge_only): parking is allowed (and on what terms)
  * charge      — ParkingTariff on paid rules
  * eligibility — PermitType on permit/badge rules, vehicle_classes filters
  * time limits — ParkingRule(kind=max_stay)
  * prohibitions— ParkingRestriction (street cleaning, loading, bus lane, market…)
  * closures    — TemporaryClosure (date-bounded, overrides everything)
  * when        — ParkingTimeWindow (weekday set + local minute range, may cross midnight)
Absence of a permission rule means UNKNOWN, never "free".
"""

from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel


class PermitKind(models.TextChoices):
    RESIDENT = "resident", "Resident permit"
    DISABLED_BADGE = "disabled_badge", "Disabled parking badge"
    COMMERCIAL = "commercial", "Commercial / loading permit"
    OTHER = "other", "Other"


class PermitType(TimeStampedModel):
    code = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=20, choices=PermitKind.choices, default=PermitKind.RESIDENT)
    description = models.TextField(blank=True)
    city = models.ForeignKey("cities.City", null=True, blank=True, on_delete=models.CASCADE)

    def __str__(self):
        return self.name


class ParkingTariff(TimeStampedModel):
    name = models.CharField(max_length=120)
    rate_per_hour = models.DecimalField(max_digits=6, decimal_places=2)
    currency = models.CharField(max_length=3, default="EUR")
    billing_increment_minutes = models.PositiveSmallIntegerField(default=15)
    minimum_charge = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(rate_per_hour__gte=0), name="tariff_rate_non_negative"),
            models.CheckConstraint(
                condition=Q(billing_increment_minutes__gte=1, billing_increment_minutes__lte=60),
                name="tariff_increment_range",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.rate_per_hour} {self.currency}/h)"


class VehicleClass(models.TextChoices):
    CAR = "car", "Car"
    MOTORCYCLE = "motorcycle", "Motorcycle"
    VAN = "van", "Van"
    EV = "ev", "Electric vehicle"


def _vehicle_array():
    return ArrayField(
        models.CharField(max_length=16, choices=VehicleClass.choices),
        default=list,
        blank=True,
        help_text="Empty = applies to all vehicle classes.",
    )


class _Sourced(TimeStampedModel):
    area = models.ForeignKey("parking.ParkingArea", on_delete=models.CASCADE)
    label = models.CharField(max_length=200)
    valid_from = models.DateField(null=True, blank=True, help_text="Local date the rule starts applying.")
    valid_until = models.DateField(null=True, blank=True, help_text="Last local date the rule applies.")
    source = models.ForeignKey("parking.ParkingDataSource", null=True, blank=True, on_delete=models.PROTECT)
    verified_at = models.DateTimeField(null=True, blank=True)
    vehicle_classes = _vehicle_array()

    class Meta:
        abstract = True


class RuleKind(models.TextChoices):
    FREE = "free", "Free parking permitted"
    PAID = "paid", "Paid parking"
    PERMIT_ONLY = "permit_only", "Permit holders only"
    BADGE_ONLY = "badge_only", "Disabled badge holders only"
    MAX_STAY = "max_stay", "Maximum stay"


class ParkingRule(_Sourced):
    area = models.ForeignKey("parking.ParkingArea", on_delete=models.CASCADE, related_name="rules")
    kind = models.CharField(max_length=16, choices=RuleKind.choices)
    tariff = models.ForeignKey(ParkingTariff, null=True, blank=True, on_delete=models.PROTECT)
    permit_type = models.ForeignKey(PermitType, null=True, blank=True, on_delete=models.PROTECT)
    max_stay_minutes = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["area_id", "kind", "id"]
        indexes = [models.Index(fields=["area", "kind"])]
        constraints = [
            models.CheckConstraint(condition=~Q(kind="paid") | Q(tariff__isnull=False), name="rule_paid_needs_tariff"),
            models.CheckConstraint(
                condition=~Q(kind__in=["permit_only", "badge_only"]) | Q(permit_type__isnull=False),
                name="rule_permit_needs_type",
            ),
            models.CheckConstraint(
                condition=~Q(kind="max_stay") | Q(max_stay_minutes__gt=0), name="rule_max_stay_positive"
            ),
            models.CheckConstraint(
                condition=Q(valid_until__isnull=True)
                | Q(valid_from__isnull=True)
                | Q(valid_until__gte=models.F("valid_from")),
                name="rule_valid_range",
            ),
        ]

    def __str__(self):
        return f"{self.get_kind_display()} — {self.label}"


class RestrictionKind(models.TextChoices):
    NO_PARKING = "no_parking", "No parking"
    NO_STOPPING = "no_stopping", "No stopping"
    LOADING = "loading", "Loading bay"
    BUS_LANE = "bus_lane", "Bus lane"
    STREET_CLEANING = "street_cleaning", "Street cleaning"
    MARKET = "market", "Street market"
    EVENT = "event", "Event"


class ParkingRestriction(_Sourced):
    area = models.ForeignKey("parking.ParkingArea", on_delete=models.CASCADE, related_name="restrictions")
    kind = models.CharField(max_length=20, choices=RestrictionKind.choices)
    exempt_permit_type = models.ForeignKey(
        PermitType, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        ordering = ["area_id", "kind", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(valid_until__isnull=True)
                | Q(valid_from__isnull=True)
                | Q(valid_until__gte=models.F("valid_from")),
                name="restriction_valid_range",
            ),
        ]

    def __str__(self):
        return f"{self.get_kind_display()} — {self.label}"


class ParkingTimeWindow(models.Model):
    """Weekly recurring local-time window. days: 0=Mon … 6=Sun (ISO). end_minute <= start_minute crosses midnight."""

    rule = models.ForeignKey(ParkingRule, null=True, blank=True, on_delete=models.CASCADE, related_name="windows")
    restriction = models.ForeignKey(
        ParkingRestriction, null=True, blank=True, on_delete=models.CASCADE, related_name="windows"
    )
    days = ArrayField(models.PositiveSmallIntegerField(), size=7)
    start_minute = models.PositiveSmallIntegerField()
    end_minute = models.PositiveSmallIntegerField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(rule__isnull=False, restriction__isnull=True) | Q(rule__isnull=True, restriction__isnull=False)
                ),
                name="window_exactly_one_parent",
            ),
            models.CheckConstraint(condition=Q(start_minute__lte=1439), name="window_start_range"),
            models.CheckConstraint(condition=Q(end_minute__gte=1, end_minute__lte=1440), name="window_end_range"),
            models.CheckConstraint(
                condition=Q(days__contained_by=[0, 1, 2, 3, 4, 5, 6]) & ~Q(days=[]), name="window_days_valid"
            ),
        ]

    def __str__(self):
        return f"days={self.days} {self.start_minute}-{self.end_minute}"


class TemporaryClosure(TimeStampedModel):
    area = models.ForeignKey("parking.ParkingArea", on_delete=models.CASCADE, related_name="closures")
    reason = models.CharField(max_length=200)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    source = models.ForeignKey("parking.ParkingDataSource", null=True, blank=True, on_delete=models.PROTECT)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["starts_at"]
        indexes = [models.Index(fields=["starts_at", "ends_at"])]
        constraints = [
            models.CheckConstraint(condition=Q(ends_at__gt=models.F("starts_at")), name="closure_end_after_start")
        ]

    def __str__(self):
        return f"Closure {self.area_id}: {self.reason}"
