"""Operational data-quality checks (management command + daily Celery task)."""

from datetime import timedelta

from django.db.models import Count, F, Q
from django.utils import timezone


def run_checks():
    from apps.availability.models import ParkingObservation
    from apps.parking.models import ParkingArea
    from apps.regulations.models import ParkingRule, ParkingTariff, ParkingTimeWindow
    from apps.reports.models import CommunityReport

    now = timezone.now()
    issues = []

    def add(code, severity, count, detail, sample=None):
        if count:
            issues.append(
                {
                    "code": code,
                    "severity": severity,
                    "count": count,
                    "detail": detail,
                    "sample": list(sample or [])[:10],
                }
            )

    exp = ParkingObservation.objects.filter(expires_at__lte=now)
    add("expired_observations", "info", exp.count(), "Expired observations awaiting purge (never served as live).")
    nosrc = ParkingArea.objects.filter(is_active=True, data_source__isnull=True).exclude(
        verification_status="unverified"
    )
    add(
        "missing_source",
        "high",
        nosrc.count(),
        "Verified/community areas without a data source.",
        nosrc.values_list("id", flat=True),
    )
    stale = ParkingArea.objects.filter(
        is_active=True, verification_status="verified", verified_at__lt=now - timedelta(days=90)
    )
    add(
        "stale_verification",
        "medium",
        stale.count(),
        "Verified more than 90 days ago.",
        stale.values_list("id", flat=True),
    )
    invalid = [a.id for a in ParkingArea.objects.exclude(geometry=None) if not a.geometry.valid]
    add("invalid_geometry", "high", len(invalid), "Geometry fails OGC validity.", invalid)
    bad_win = ParkingTimeWindow.objects.filter(start_minute=F("end_minute"))
    add(
        "zero_length_window",
        "medium",
        bad_win.count(),
        "Window start equals end (ambiguous).",
        bad_win.values_list("id", flat=True),
    )
    conflict = (
        ParkingRule.objects.filter(kind__in=["permit_only", "badge_only"])
        .values("area")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
    )
    add(
        "conflicting_exclusive_rules",
        "medium",
        conflict.count(),
        "Areas with several exclusive permit rules.",
        [c["area"] for c in conflict],
    )
    multi_rate = (
        ParkingRule.objects.filter(kind="paid")
        .values("area")
        .annotate(n=Count("tariff__rate_per_hour", distinct=True))
        .filter(n__gt=1)
    )
    add(
        "inconsistent_tariffs",
        "low",
        multi_rate.count(),
        "Areas with several paid tariffs (cheapest applies).",
        [c["area"] for c in multi_rate],
    )
    zero = ParkingTariff.objects.filter(rate_per_hour=0)
    add("zero_rate_tariff", "low", zero.count(), "Paid tariffs with a 0 rate.", zero.values_list("id", flat=True))
    urgent = CommunityReport.objects.filter(
        status__in=["pending_review", "under_review"],
        type__in=["closure", "new_sign", "incorrect_rule"],
        created_at__lt=now - timedelta(hours=24),
    )
    add(
        "unreviewed_priority_corrections",
        "high",
        urgent.count(),
        "Priority corrections pending > 24 h.",
        urgent.values_list("reference", flat=True),
    )
    unverified_rules = ParkingArea.objects.filter(Q(verification_status="unverified"), rules__isnull=False).distinct()
    add(
        "rules_on_unverified_area",
        "info",
        unverified_rules.count(),
        "Rules exist but area is unverified (served as unknown).",
    )
    return {"checked_at": now.isoformat(), "issues": issues}
