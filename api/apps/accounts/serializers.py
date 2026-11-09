from django.contrib.auth import get_user_model, password_validation
from rest_framework import serializers

from apps.regulations.models import PermitType

from .models import Language, UserPreference

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, min_length=8, max_length=128, trim_whitespace=False)
    display_name = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    language = serializers.ChoiceField(choices=Language.choices, required=False, default=Language.EN)
    accept_terms = serializers.BooleanField()

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.", code="email_taken")
        return value

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError("You must accept the terms to create an account.", code="terms_required")
        return value

    def validate(self, attrs):
        password_validation.validate_password(attrs["password"], User(email=attrs["email"]))
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class RefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False)
    everywhere = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if not attrs.get("everywhere") and not attrs.get("refresh"):
            raise serializers.ValidationError({"refresh": "Provide the refresh token, or everywhere=true."})
        return attrs


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=2048)


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=2048)
    new_password = serializers.CharField(min_length=8, max_length=128, trim_whitespace=False)

    def validate_new_password(self, value):
        password_validation.validate_password(value)
        return value


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source="profile.display_name", max_length=80, allow_blank=True, required=False)
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "display_name", "is_email_verified", "date_joined", "roles"]
        read_only_fields = ["id", "email", "is_email_verified", "date_joined", "roles"]

    def get_roles(self, obj) -> list[str]:
        return sorted(obj.roles.values_list("role", flat=True))

    def update(self, instance, validated):
        profile = validated.pop("profile", {})
        if "display_name" in profile:
            instance.profile.display_name = profile["display_name"].strip()
            instance.profile.save(update_fields=["display_name", "updated_at"])
        return instance


class AuthResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    tokens = TokenPairSerializer()


class DeleteAccountSerializer(serializers.Serializer):
    confirm = serializers.CharField()
    password = serializers.CharField(required=False, trim_whitespace=False)

    def validate_confirm(self, value):
        if value.strip().upper() != "DELETE":
            raise serializers.ValidationError("Type DELETE to confirm.", code="confirmation_required")
        return value


class PreferenceSerializer(serializers.ModelSerializer):
    permit_type = serializers.SlugRelatedField(
        slug_field="code", queryset=PermitType.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = UserPreference
        fields = [
            "language",
            "max_walk_minutes",
            "free_only_default",
            "offer_paid_alternatives",
            "default_reminder_minutes",
            "vehicle_class",
            "permit_type",
            "has_disabled_badge",
            "personalised_results",
            "analytics_opt_in",
            "personalised_ads",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
        extra_kwargs = {
            "max_walk_minutes": {"min_value": 1, "max_value": 30},
            "default_reminder_minutes": {"min_value": 0, "max_value": 120},
        }
