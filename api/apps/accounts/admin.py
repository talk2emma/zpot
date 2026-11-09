from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import ConsentRecord, DeviceRegistration, User, UserPreference, UserProfile, UserRole


class RoleInline(admin.TabularInline):
    model = UserRole
    fk_name = "user"
    extra = 0


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "is_email_verified", "is_staff", "date_joined")
    search_fields = ("email",)
    inlines = [RoleInline]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Status", {"fields": ("is_active", "is_email_verified", "email_verified_at", "is_staff", "is_superuser")}),
        ("Permissions", {"fields": ("groups", "user_permissions")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),)


admin.site.register([UserProfile, UserPreference, DeviceRegistration])


@admin.register(ConsentRecord)
class ConsentAdmin(admin.ModelAdmin):
    list_display = ("user", "consent_type", "granted", "document_version", "recorded_at")
    readonly_fields = [f.name for f in ConsentRecord._meta.fields]
