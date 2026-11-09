from rest_framework import serializers

from .models import ParkingObservation


class ObservationSerializer(serializers.ModelSerializer):
    age_minutes = serializers.SerializerMethodField()

    class Meta:
        model = ParkingObservation
        fields = ["id", "kind", "observed_at", "expires_at", "confirmations", "contradictions", "age_minutes"]

    def get_age_minutes(self, obj) -> int:
        from django.utils import timezone

        return int((timezone.now() - obj.observed_at).total_seconds() // 60)
