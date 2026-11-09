from django.contrib import admin

from .models import ContributorTrustEvent, ReportVerification


@admin.register(ContributorTrustEvent)
class TrustEventAdmin(admin.ModelAdmin):
    list_display = ("user", "delta", "reason", "report", "created_at")
    list_filter = ("reason",)
    search_fields = ("user__email",)


@admin.register(ReportVerification)
class VerificationAdmin(admin.ModelAdmin):
    list_display = ("observation", "answer", "created_at")
    list_filter = ("answer",)
