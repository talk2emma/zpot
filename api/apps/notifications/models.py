import uuid

from django.conf import settings
from django.db import models


class Category(models.TextChoices):
    SESSION_REMINDER = "session_reminder", "Session reminder"
    RESTRICTION = "restriction", "Restriction deadline"  # essential legal guidance — always delivered to the inbox
    RULE_CHANGE = "rule_change", "Rule change"
    REPORT_UPDATE = "report_update", "Report update"
    SAVED_LOCATION = "saved_location", "Saved location"
    SERVICE = "service", "Announcement"
    PRIVACY = "privacy", "Privacy request"
    SUPPORT = "support", "Support"


ESSENTIAL = {Category.RESTRICTION, Category.PRIVACY}


class PushStatus(models.TextChoices):
    NOT_CONFIGURED = "not_configured", "No push provider configured (inbox only)"
    NO_DEVICE = "no_device", "No registered device"
    SENT = "sent", "Sent to provider"
    FAILED = "failed", "Provider error"
    SUPPRESSED = "suppressed", "Push disabled by user preference"


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    category = models.CharField(max_length=20, choices=Category.choices)
    template = models.CharField(max_length=64, blank=True)
    params = models.JSONField(default=dict, blank=True)
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=500)
    target = models.JSONField(default=dict, blank=True, help_text='Deep-link target, e.g. {"route":"Session","id":"…"}')
    dedupe_key = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    push_status = models.CharField(max_length=16, choices=PushStatus.choices, default=PushStatus.NOT_CONFIGURED)
    push_attempted_at = models.DateTimeField(null=True, blank=True)
    push_error = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "dedupe_key"], name="notification_dedupe")]
        indexes = [models.Index(fields=["user", "read_at"])]

    def __str__(self):
        return f"{self.category}: {self.title}"


class NotificationPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_prefs")
    session_reminders = models.BooleanField(default=True)
    rule_changes = models.BooleanField(default=True)
    report_updates = models.BooleanField(default=True)
    saved_locations = models.BooleanField(default=True)
    service_news = models.BooleanField(default=False)
    push_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"prefs {self.user_id}"
