from django.urls import path

from . import views

urlpatterns = [
    path("availability/nearby/", views.NearbyAvailabilityView.as_view(), name="availability-nearby"),
    path("availability/observations/", views.ObservationListCreateView.as_view(), name="availability-observations"),
    path("verify/", views.VerifyCompatView.as_view(), name="verify-compat"),
]
