from celery import shared_task

from . import services


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=3)
def process_privacy_request(request_id):
    r = services.process(request_id)
    return r.status if r else None


@shared_task
def retention_cleanup():
    return services.retention_cleanup()
