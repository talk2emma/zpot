from django.contrib import admin
from django.urls import include, path

api_v1 = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls.auth")),
    path("users/", include("apps.accounts.urls.users")),
    path("", include("apps.cities.urls")),
    path("", include("apps.parking.urls")),
    path("regulations/", include("apps.regulations.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    path("", include("apps.accounts.urls.web")),
]
