from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.contrib import admin, messages
from django.utils import timezone

from apps.core.permissions import has_role

from . import services
from .models import CommunityReport, ModerationDecision, ReportAppeal, ReportAttachment, ReportModeration

REJECT_REASON = "Insufficient evidence — we couldn't confirm the change. A photo of the sign helps."


class AttachmentInline(admin.TabularInline):
    model = ReportAttachment
    extra = 0
    readonly_fields = ("file", "content_type", "size", "width", "height", "metadata_stripped", "uploaded_at")
    can_delete = False


class ModerationInline(admin.TabularInline):
    model = ReportModeration
    extra = 0
    readonly_fields = ("moderator", "decision", "reason", "from_status", "to_status", "created_at")
    can_delete = False


@admin.register(CommunityReport)
class CommunityReportAdmin(admin.ModelAdmin):
    list_display = ("reference", "type", "status", "area", "trust_score", "created_at")
    list_filter = ("status", "type")
    search_fields = ("reference", "area__name", "description")
    readonly_fields = (
        "reference",
        "reporter",
        "client_token",
        "type",
        "area",
        "location",
        "details",
        "description",
        "trust_score",
        "trust_explanation",
        "observation",
        "created_at",
    )
    inlines = [AttachmentInline, ModerationInline]
    actions = ["start_review", "accept", "reject", "escalate", "accept_and_create_closure"]

    def _run(self, request, qs, decision, reason=""):
        if not has_role(request.user, "data_reviewer", "admin"):
            self.message_user(request, "Only data reviewers can moderate.", messages.ERROR)
            return 0
        n = 0
        for r in qs:
            try:
                services.moderate(r, moderator=request.user, decision=decision, reason=reason)
                n += 1
            except Exception as exc:  # noqa: BLE001
                self.message_user(request, f"{r.reference}: {exc}", messages.WARNING)
        self.message_user(request, f"{n} report(s): {decision}")
        return n

    @admin.action(description="Start review")
    def start_review(self, request, qs):
        self._run(request, qs, ModerationDecision.START_REVIEW)

    @admin.action(description="Accept")
    def accept(self, request, qs):
        self._run(request, qs, ModerationDecision.ACCEPT)

    @admin.action(description="Reject (insufficient evidence)")
    def reject(self, request, qs):
        self._run(request, qs, ModerationDecision.REJECT, REJECT_REASON)

    @admin.action(description="Send a scout")
    def escalate(self, request, qs):
        self._run(request, qs, ModerationDecision.ESCALATE_TO_SCOUT)

    @admin.action(description="Accept closure report and create a temporary closure (audited)")
    def accept_and_create_closure(self, request, qs):
        from apps.regulations.models import TemporaryClosure

        tz = ZoneInfo("Europe/Lisbon")
        for r in qs.filter(type="closure", area__isnull=False):
            if not self._run(request, CommunityReport.objects.filter(pk=r.pk), ModerationDecision.ACCEPT):
                continue
            days = {"today": 0, "few_days": 3}.get(r.details.get("until"), 1)
            end = datetime.combine(timezone.now().astimezone(tz).date() + timedelta(days=days), time(23, 59), tzinfo=tz)
            TemporaryClosure.objects.create(
                area=r.area,
                reason=f"Reported closure ({r.reference}), confirmed by reviewer",
                starts_at=timezone.now(),
                ends_at=end,
                verified_at=timezone.now(),
            )


@admin.register(ReportAppeal)
class ReportAppealAdmin(admin.ModelAdmin):
    list_display = ("report", "user", "status", "created_at", "resolved_at")
    list_filter = ("status",)
