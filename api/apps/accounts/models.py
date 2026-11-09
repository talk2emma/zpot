import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from apps.core.models import TimeStampedModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, is_email_verified=True)
        return self._create_user(email, password, **extra)

    def get_by_natural_key(self, username):
        return self.get(email__iexact=username)


class User(AbstractBaseUser, PermissionsMixin):
    """Email-identified account. Parking discovery never requires one (guest-first)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=254, unique=True)
    is_email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()
    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        constraints = [models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique")]

    def __str__(self):
        return self.email


class UserProfile(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=80, blank=True)
    home_city = models.ForeignKey("cities.City", null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.display_name or self.user.email


class Language(models.TextChoices):
    EN = "en", "English"
    PT_PT = "pt-PT", "Português (Portugal)"


class VehicleClass(models.TextChoices):
    CAR = "car", "Car"
    MOTORCYCLE = "motorcycle", "Motorcycle"
    VAN = "van", "Van"
    EV = "ev", "Electric vehicle"


class UserPreference(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="preferences")
    language = models.CharField(max_length=8, choices=Language.choices, default=Language.EN)
    max_walk_minutes = models.PositiveSmallIntegerField(default=10)
    free_only_default = models.BooleanField(default=False)
    offer_paid_alternatives = models.BooleanField(default=True)
    default_reminder_minutes = models.PositiveSmallIntegerField(default=15)
    vehicle_class = models.CharField(max_length=16, choices=VehicleClass.choices, default=VehicleClass.CAR)
    permit_type = models.ForeignKey("regulations.PermitType", null=True, blank=True, on_delete=models.SET_NULL)
    has_disabled_badge = models.BooleanField(default=False)
    personalised_results = models.BooleanField(default=True)
    analytics_opt_in = models.BooleanField(default=False)
    personalised_ads = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(max_walk_minutes__gte=1, max_walk_minutes__lte=30), name="pref_walk_range"
            ),
            models.CheckConstraint(condition=models.Q(default_reminder_minutes__lte=120), name="pref_reminder_range"),
        ]


class Role(models.TextChoices):
    DRIVER = "driver", "Driver"
    SCOUT = "scout", "Scout"
    DATA_REVIEWER = "data_reviewer", "Data reviewer"
    ADMIN = "admin", "Administrator"


class UserRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="roles")
    role = models.CharField(max_length=24, choices=Role.choices)
    granted_at = models.DateTimeField(auto_now_add=True)
    granted_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "role"], name="user_role_unique")]

    def __str__(self):
        return f"{self.user_id}:{self.role}"


class Platform(models.TextChoices):
    IOS = "ios", "iOS"
    ANDROID = "android", "Android"


class DeviceRegistration(TimeStampedModel):
    """Push/device registration — populated by the Part 2 notification engine."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    platform = models.CharField(max_length=10, choices=Platform.choices)
    push_token = models.CharField(max_length=512)
    app_version = models.CharField(max_length=32, blank=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["platform", "push_token"], name="device_token_unique")]

    def __str__(self):
        return f"{self.platform} device for {self.user_id}"


class ConsentType(models.TextChoices):
    TERMS = "terms", "Terms of service"
    PRIVACY = "privacy", "Privacy notice"
    ANALYTICS = "analytics", "Usage analytics"
    PERSONALISED_ADS = "personalised_ads", "Personalised ads"
    MARKETING = "marketing", "Marketing email"


class ConsentRecord(models.Model):
    """Append-only consent ledger (GDPR accountability)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="consents")
    consent_type = models.CharField(max_length=24, choices=ConsentType.choices)
    document_version = models.CharField(max_length=32, default="draft-2026-11")
    granted = models.BooleanField()
    recorded_at = models.DateTimeField(auto_now_add=True)
    source = models.CharField(max_length=32, default="mobile")

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [models.Index(fields=["user", "consent_type", "-recorded_at"])]

    def __str__(self):
        return f"{self.consent_type}={self.granted}"
