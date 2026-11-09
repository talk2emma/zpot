from django.urls import path

from apps.accounts import web

urlpatterns = [
    path("verify-email/", web.verify_email_page, name="web-verify-email"),
    path("reset-password/", web.reset_password_page, name="web-reset-password"),
]
