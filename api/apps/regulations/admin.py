from django.contrib import admin

from .models import (
    ParkingRestriction,
    ParkingRule,
    ParkingTariff,
    ParkingTimeWindow,
    PermitType,
    TemporaryClosure,
)


class RuleWindowInline(admin.TabularInline):
    model = ParkingTimeWindow
    fk_name = "rule"
    exclude = ("restriction",)
    extra = 0


class RestrictionWindowInline(admin.TabularInline):
    model = ParkingTimeWindow
    fk_name = "restriction"
    exclude = ("rule",)
    extra = 0


@admin.register(ParkingRule)
class RuleAdmin(admin.ModelAdmin):
    list_display = ("area", "kind", "label", "valid_from", "valid_until", "verified_at")
    list_filter = ("kind",)
    inlines = [RuleWindowInline]


@admin.register(ParkingRestriction)
class RestrictionAdmin(admin.ModelAdmin):
    list_display = ("area", "kind", "label", "valid_from", "valid_until")
    inlines = [RestrictionWindowInline]


admin.site.register([PermitType, ParkingTariff, TemporaryClosure])
