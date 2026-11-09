from django.contrib import admin
from django.urls import include, path

api_v1 = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls.auth")),
    path("users/", include("apps.accounts.urls.users")),
    path("", include("apps.cities.urls")),
    path("", include("apps.parking.urls")),
    path("regulations/", include("apps.regulations.urls")),
    path("", include("apps.sessions.urls")),
    path("", include("apps.reports.urls")),
    path("", include("apps.community.urls")),
    path("", include("apps.availability.urls")),
    path("", include("apps.saved.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.support.urls")),
    path("", include("apps.privacy.urls")),
    path("", include("apps.scouts.urls")),
    path("", include("apps.detection.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    path("", include("apps.accounts.urls.web")),
]
