from django.contrib import admin, messages

from apps.core.permissions import has_role

from . import services
from .models import ScoutAssignment, ScoutPhoto, ScoutSubmission


class PhotoInline(admin.TabularInline):
    model = ScoutPhoto
    extra = 0
    readonly_fields = ("file", "size", "uploaded_at")


@admin.register(ScoutAssignment)
class ScoutAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "area", "assigned_to", "status", "reason", "due_at", "created_at")
    list_filter = ("status",)
    search_fields = ("area__name", "reason")
    autocomplete_fields = ("area",)


@admin.register(ScoutSubmission)
class ScoutSubmissionAdmin(admin.ModelAdmin):
    list_display = ("assignment", "scout", "outcome", "review_status", "submitted_at")
    list_filter = ("review_status", "outcome")
    readonly_fields = (
        "assignment",
        "scout",
        "outcome",
        "observed_rules",
        "notes",
        "submitted_at",
        "reviewed_by",
        "reviewed_at",
    )
    inlines = [PhotoInline]
    actions = ["approve", "reject"]

    def _review(self, request, qs, approve):
        if not has_role(request.user, "data_reviewer", "admin"):
            self.message_user(request, "Only data reviewers can approve scout evidence.", messages.ERROR)
            return
        n = 0
        for s in qs.filter(review_status="pending"):
            services.review(s, reviewer=request.user, approve=approve)
            n += 1
        self.message_user(request, f"{n} submission(s) {'approved' if approve else 'rejected'}.")

    @admin.action(description="Approve evidence (updates verification + audit)")
    def approve(self, request, qs):
        self._review(request, qs, True)

    @admin.action(description="Reject evidence")
    def reject(self, request, qs):
        self._review(request, qs, False)
