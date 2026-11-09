import uuid

from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditEvent(models.Model):
    """Append-only audit trail for security- and trust-relevant actions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=80, db_index=True)
    target_type = models.CharField(max_length=80, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} {self.target_type}:{self.target_id}"


def record_audit(action, *, actor=None, target=None, request=None, **metadata):
    ip = None
    if request is not None:
        ip = request.META.get("REMOTE_ADDR")
        if actor is None and getattr(request, "user", None) and request.user.is_authenticated:
            actor = request.user
    return AuditEvent.objects.create(
        action=action,
        actor=actor if (actor is not None and getattr(actor, "pk", None)) else None,
        target_type=target.__class__.__name__ if target is not None else "",
        target_id=str(getattr(target, "pk", "")) if target is not None else "",
        metadata=metadata,
        ip_address=ip,
    )


class FeatureFlag(models.Model):
    """Server-governed feature flag. Overrides the environment default in settings.ZPOT["FEATURES"]."""

    key = models.SlugField(max_length=64, unique=True)
    enabled = models.BooleanField(default=False)
    description = models.CharField(max_length=240, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return f"{self.key}={'on' if self.enabled else 'off'}"
