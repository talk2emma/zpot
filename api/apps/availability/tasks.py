from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import ParkingObservation


@shared_task
def purge_expired_observations():
    """Housekeeping only — expiry is already enforced on reads."""
    from apps.reports.models import CommunityReport, ReportStatus

    CommunityReport.objects.filter(status=ReportStatus.PUBLISHED, observation__expires_at__lt=timezone.now()).update(
        status=ReportStatus.EXPIRED
    )
    cutoff = timezone.now() - timedelta(days=settings.ZPOT["OBSERVATION_RETENTION_DAYS"])
    n, _ = ParkingObservation.objects.filter(expires_at__lt=cutoff).delete()
    return n
