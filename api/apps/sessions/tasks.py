from celery import shared_task

from . import services


@shared_task
def dispatch_due_reminders():
    return services.dispatch_due()


@shared_task
def expire_stale_sessions():
    return services.expire_stale()
