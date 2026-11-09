from rest_framework import serializers

from apps.accounts.models import DeviceRegistration, Platform

from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "category",
            "template",
            "params",
            "title",
            "body",
            "target",
            "created_at",
            "read_at",
            "is_read",
            "push_status",
        ]

    def get_is_read(self, obj) -> bool:
        return obj.read_at is not None


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    restriction_alerts = serializers.SerializerMethodField(help_text="Essential legal alerts — always on.")

    class Meta:
        model = NotificationPreference
        fields = [
            "session_reminders",
            "rule_changes",
            "report_updates",
            "saved_locations",
            "service_news",
            "push_enabled",
            "restriction_alerts",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def get_restriction_alerts(self, obj) -> bool:
        return True


class DeviceSerializer(serializers.ModelSerializer):
    platform = serializers.ChoiceField(choices=Platform.choices)

    class Meta:
        model = DeviceRegistration
        fields = ["id", "platform", "push_token", "app_version", "last_seen_at", "is_active"]
        read_only_fields = ["id", "last_seen_at", "is_active"]
        extra_kwargs = {"push_token": {"validators": []}}
        validators = []  # re-registering the same token is an upsert, not an error
