from django.contrib import admin

from .models import Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "category", "title", "read_at", "push_status")
    list_filter = ("category", "push_status")
    search_fields = ("user__email", "title", "dedupe_key")
    readonly_fields = [f.name for f in Notification._meta.fields]


admin.site.register(NotificationPreference)
