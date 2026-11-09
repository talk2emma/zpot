from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from . import views

urlpatterns = [
    path("health/", views.HealthView.as_view(), name="health"),
    path("ready/", views.ReadyView.as_view(), name="ready"),
    path("config/", views.ConfigView.as_view(), name="config"),
    path("features/", views.FeaturesView.as_view(), name="features"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
