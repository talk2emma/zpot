from django.urls import path

from ..vehicles import VehicleActivateView, VehicleDetailView, VehicleListView

urlpatterns = [
    path("vehicles/", VehicleListView.as_view(), name="vehicle-list"),
    path("vehicles/<int:pk>/", VehicleDetailView.as_view(), name="vehicle-detail"),
    path("vehicles/<int:pk>/activate/", VehicleActivateView.as_view(), name="vehicle-activate"),
]
