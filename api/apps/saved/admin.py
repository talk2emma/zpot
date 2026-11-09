from django.contrib import admin

from .models import SavedDestination, SavedParkingLocation, SearchHistory


@admin.register(SavedParkingLocation)
class SavedLocationAdmin(admin.ModelAdmin):
    list_display = ("user", "label", "area", "category_at_save", "created_at")
    search_fields = ("user__email", "label")


admin.site.register([SavedDestination, SearchHistory])
