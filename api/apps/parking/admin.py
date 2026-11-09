from django.contrib.gis import admin

from .models import ParkingArea, ParkingDataRevision, ParkingDataSource, ParkingEvidence, StreetSegment


class EvidenceInline(admin.TabularInline):
    model = ParkingEvidence
    extra = 0


@admin.register(ParkingArea)
class ParkingAreaAdmin(admin.GISModelAdmin):
    list_display = ("name", "city", "supported_area", "kind", "verification_status", "verified_at")
    list_filter = ("verification_status", "kind", "supported_area")
    search_fields = ("name", "external_ref")
    inlines = [EvidenceInline]


@admin.register(ParkingDataRevision)
class RevisionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "area", "object_type", "object_id", "action", "changed_by")
    readonly_fields = [f.name for f in ParkingDataRevision._meta.fields]


admin.site.register(ParkingDataSource)
admin.site.register(StreetSegment, admin.GISModelAdmin)
