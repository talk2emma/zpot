import uuid

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class HelpArticle(models.Model):
    slug = models.SlugField(unique=True)
    category = models.CharField(max_length=32, default="general")
    title_en = models.CharField(max_length=160)
    title_pt = models.CharField(max_length=160)
    body_en = models.TextField()
    body_pt = models.TextField()
    order = models.PositiveSmallIntegerField(default=0)
    published = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "slug"]

    def __str__(self):
        return self.title_en


class TicketCategory(models.TextChoices):
    ACCOUNT = "account", "Account"
    MAP_SEARCH = "map_search", "Map or search"
    REPORTS = "reports", "Reports"
    WRONG_RULE = "wrong_rule", "Wrong rule (guidance problem)"
    WRONG_PRICE = "wrong_price", "Wrong price (guidance problem)"
    GOT_FINE = "got_fine", "Got a fine (guidance problem)"
    PRIVACY = "privacy", "Privacy"
    OTHER = "other", "Something else"


GUIDANCE_CATEGORIES = {TicketCategory.WRONG_RULE, TicketCategory.WRONG_PRICE, TicketCategory.GOT_FINE}


class SupportStatus(models.TextChoices):
    OPEN = "open", "Open"
    IN_PROGRESS = "in_progress", "In progress"
    WAITING_USER = "waiting_user", "Waiting for you"
    RESOLVED = "resolved", "Resolved"
    CLOSED = "closed", "Closed"


class SupportTicket(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=16, unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="support_tickets"
    )
    contact_email = models.EmailField(blank=True)
    category = models.CharField(max_length=16, choices=TicketCategory.choices)
    description = models.TextField(max_length=3000)
    context = models.JSONField(default=dict, blank=True, help_text="Only what the user chose to include.")
    status = models.CharField(max_length=14, choices=SupportStatus.choices, default=SupportStatus.OPEN)
    priority = models.CharField(max_length=8, choices=[("normal", "Normal"), ("high", "High")], default="normal")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_tickets"
    )
    staff_reply = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.reference


class SupportAttachment(models.Model):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="support/%Y/%m/")
    content_type = models.CharField(max_length=40)
    size = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"attachment {self.id} for {self.ticket_id}"
