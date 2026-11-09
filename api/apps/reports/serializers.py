from rest_framework import serializers

from .models import CommunityReport, ReportAttachment, ReportType


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportAttachment
        fields = ["id", "content_type", "size", "width", "height", "metadata_stripped", "uploaded_at"]


class ReportSerializer(serializers.ModelSerializer):
    """Owner/reviewer view. Never includes the reporter's identity or device location."""

    location = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)
    history = serializers.SerializerMethodField()
    appeal = serializers.SerializerMethodField()
    observation = serializers.SerializerMethodField()
    type_label = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = CommunityReport
        fields = [
            "id",
            "reference",
            "type",
            "type_label",
            "status",
            "area",
            "location",
            "scope",
            "details",
            "description",
            "trust_score",
            "rejection_reason",
            "attachments",
            "observation",
            "history",
            "appeal",
            "created_at",
            "updated_at",
        ]

    def get_location(self, o) -> dict:
        return {"latitude": o.location.y, "longitude": o.location.x}

    def get_area(self, o) -> dict | None:
        return {"id": o.area_id, "name": o.area.name} if o.area_id else None

    def get_history(self, o) -> list:
        h = [{"event": "submitted", "at": o.created_at}]
        if o.status == "published":
            h.append({"event": "published_temporarily", "at": o.created_at})
        for m in o.moderations.all():
            h.append({"event": m.decision, "at": m.created_at, "status": m.to_status, "reason": m.reason})
        if hasattr(o, "appeal"):
            h.append({"event": "appeal_sent", "at": o.appeal.created_at, "status": o.appeal.status})
        return sorted(h, key=lambda x: x["at"])

    def get_appeal(self, o) -> dict | None:
        a = getattr(o, "appeal", None)
        return {"status": a.status, "message": a.message, "created_at": a.created_at} if a else None

    def get_observation(self, o) -> dict | None:
        from apps.availability.services import state_of

        obs = o.observation
        if not obs:
            return None
        return {
            "id": obs.id,
            "state": state_of(obs).value,
            "expires_at": obs.expires_at,
            "confirmations": obs.confirmations,
            "contradictions": obs.contradictions,
        }


class ReviewerReportSerializer(ReportSerializer):
    trust_explanation = serializers.JSONField(read_only=True)

    class Meta(ReportSerializer.Meta):
        fields = ReportSerializer.Meta.fields + ["trust_explanation"]


class CreateReportSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=ReportType.choices)
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    area_id = serializers.IntegerField(required=False, allow_null=True)
    scope = serializers.ChoiceField(choices=["spot", "segment"], default="spot")
    details = serializers.DictField(required=False, default=dict)
    description = serializers.CharField(required=False, allow_blank=True, max_length=1000, default="")
    device_latitude = serializers.FloatField(
        required=False, min_value=-90, max_value=90, help_text="Used once for the trust score; not stored."
    )
    device_longitude = serializers.FloatField(required=False, min_value=-180, max_value=180)

    def validate_details(self, value):
        allowed = {"confirm", "issue", "until", "spot_size", "from_session"}
        bad = set(value) - allowed
        if bad:
            raise serializers.ValidationError(f"Unknown detail fields: {sorted(bad)}")
        return value


class UpdateReportSerializer(serializers.Serializer):
    description = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    decision = serializers.ChoiceField(
        choices=["start_review", "accept", "reject", "duplicate", "escalate_to_scout"], required=False
    )
    reason = serializers.CharField(required=False, allow_blank=True, max_length=300, default="")


class AppealSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)


class VerificationSerializer(serializers.Serializer):
    answer = serializers.ChoiceField(choices=["still_available", "taken", "unsure"])
