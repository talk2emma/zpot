from django.contrib import admin

from .models import DataPrivacyRequest


@admin.register(DataPrivacyRequest)
class PrivacyRequestAdmin(admin.ModelAdmin):
    list_display = ("reference", "kind", "status", "user_email", "created_at", "completed_at")
    list_filter = ("kind", "status")
    readonly_fields = [f.name for f in DataPrivacyRequest._meta.fields]
