from rest_framework import serializers

from .models import ParkingReminder, ParkingSession, ParkingSessionEvent


class ReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingReminder
        fields = ["id", "kind", "minutes_before", "fire_at", "status", "sent_at"]


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingSessionEvent
        fields = ["kind", "data", "created_at"]


class SessionSerializer(serializers.ModelSerializer):
    area = serializers.SerializerMethodField()
    remaining_minutes = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    reminders = ReminderSerializer(many=True, read_only=True)

    class Meta:
        model = ParkingSession
        fields = [
            "id",
            "status",
            "area",
            "started_at",
            "planned_end_at",
            "ended_at",
            "reminder_minutes",
            "category",
            "legal_status",
            "restriction_deadline",
            "restriction_reason",
            "expected_cost",
            "evaluated_at",
            "evaluation",
            "remaining_minutes",
            "is_overdue",
            "cost_paid",
            "outcome",
            "shared_departure",
            "reminders",
            "created_at",
            "updated_at",
        ]

    def get_area(self, obj) -> dict:
        a = obj.area
        return {
            "id": a.id,
            "name": a.name,
            "latitude": a.location.y,
            "longitude": a.location.x,
            "verification_status": a.verification_status,
        }

    def get_remaining_minutes(self, obj) -> int | None:
        from django.utils import timezone

        if obj.status != "active":
            return None
        return int((obj.planned_end_at - timezone.now()).total_seconds() // 60)

    def get_is_overdue(self, obj) -> bool:
        r = self.get_remaining_minutes(obj)
        return r is not None and r < 0


class SessionDetailSerializer(SessionSerializer):
    events = EventSerializer(many=True, read_only=True)

    class Meta(SessionSerializer.Meta):
        fields = SessionSerializer.Meta.fields + ["events"]


class StartSessionSerializer(serializers.Serializer):
    area_id = serializers.IntegerField()
    planned_end_at = serializers.DateTimeField(required=False)
    duration_minutes = serializers.IntegerField(required=False, min_value=15, max_value=1440)
    reminder_minutes = serializers.ChoiceField(choices=[0, 5, 10, 15, 30, 60], default=15)
    vehicle_class = serializers.ChoiceField(choices=["car", "motorcycle", "van", "ev"], default="car")
    permit_type = serializers.SlugField(required=False, allow_blank=True, default="")
    has_disabled_badge = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if "planned_end_at" in attrs and "duration_minutes" in attrs:
            raise serializers.ValidationError(
                {"duration_minutes": "Send planned_end_at or duration_minutes, not both."}
            )
        return attrs


class UpdateSessionSerializer(serializers.Serializer):
    planned_end_at = serializers.DateTimeField(required=False)
    reminder_minutes = serializers.ChoiceField(choices=[0, 5, 10, 15, 30, 60], required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Nothing to update.")
        return attrs


class EndSessionSerializer(serializers.Serializer):
    cost_paid = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=0, required=False, allow_null=True)
    outcome = serializers.ChoiceField(choices=["", "easy", "ok", "hard"], required=False, default="")
    share_departure = serializers.BooleanField(default=False)


class AddReminderSerializer(serializers.Serializer):
    minutes_before = serializers.IntegerField(min_value=1, max_value=240)


class SessionSummarySerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    area = serializers.DictField()
    status = serializers.CharField()
    started_at = serializers.DateTimeField()
    ended_at = serializers.DateTimeField(allow_null=True)
    duration_minutes = serializers.IntegerField()
    verification_status = serializers.CharField()
    expected_cost = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    cost_paid = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    estimated_saving = serializers.DictField(allow_null=True)
    shared_departure = serializers.BooleanField()
    outcome = serializers.CharField()
