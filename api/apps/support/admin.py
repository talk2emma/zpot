from django.contrib import admin

from apps.notifications.models import Category
from apps.notifications.services import notify

from .models import HelpArticle, SupportAttachment, SupportTicket


class AttachmentInline(admin.TabularInline):
    model = SupportAttachment
    extra = 0
    readonly_fields = ("file", "content_type", "size", "uploaded_at")


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("reference", "category", "status", "priority", "user", "assigned_to", "created_at")
    list_filter = ("status", "category", "priority")
    search_fields = ("reference", "contact_email", "description")
    readonly_fields = ("reference", "user", "contact_email", "category", "description", "context", "created_at")
    inlines = [AttachmentInline]

    def save_model(self, request, obj, form, change):
        changed = change and {"status", "staff_reply"} & set(form.changed_data)
        super().save_model(request, obj, form, change)
        if changed and obj.user_id:
            notify(
                obj.user,
                Category.SUPPORT,
                "support_update",
                {"ref": obj.reference, "status": obj.get_status_display(), "detail": obj.staff_reply or ""},
                dedupe_key=f"support:{obj.id}:{obj.status}:{obj.updated_at.timestamp()}",
                target={"route": "SupportTicket", "id": str(obj.id)},
            )


admin.site.register(HelpArticle)
