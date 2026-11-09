from celery import shared_task
from django.core.mail import send_mail


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=5)
def send_email_task(subject, body, to, html=None):
    send_mail(subject, body, None, [to], html_message=html, fail_silently=False)
