from django.contrib import admin

from .models import ParkingReminder, ParkingSession, ParkingSessionEvent


class EventInline(admin.TabularInline):
    model = ParkingSessionEvent
    extra = 0
    readonly_fields = ("kind", "data", "created_at")
    can_delete = False


class ReminderInline(admin.TabularInline):
    model = ParkingReminder
    extra = 0
    readonly_fields = ("kind", "minutes_before", "fire_at", "status", "sent_at", "attempts", "last_error")


@admin.register(ParkingSession)
class ParkingSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "area", "status", "started_at", "planned_end_at", "restriction_deadline", "category")
    list_filter = ("status", "category")
    search_fields = ("user__email", "area__name")
    readonly_fields = ("evaluation", "evaluated_at", "created_at", "updated_at")
    inlines = [ReminderInline, EventInline]


@admin.register(ParkingReminder)
class ParkingReminderAdmin(admin.ModelAdmin):
    list_display = ("session", "kind", "fire_at", "status", "attempts", "sent_at")
    list_filter = ("status", "kind")
