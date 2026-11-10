from celery import shared_task

from . import services


@shared_task
def process_privacy_request(request_id):
    r = services.process(request_id)
    return r.status if r else None


@shared_task
def retention_cleanup():
    return services.retention_cleanup()
