from django.urls import path

from . import views

urlpatterns = [
    path("parking/options/", views.ParkingOptionsView.as_view(), name="parking-options"),
    path("parking/areas/", views.ParkingAreaListView.as_view(), name="parking-area-list"),
    path("parking/areas/<int:pk>/", views.ParkingAreaDetailView.as_view(), name="parking-area-detail"),
    path("parking/areas/<int:pk>/rules/", views.ParkingAreaRulesView.as_view(), name="parking-area-rules"),
    path(
        "parking/areas/<int:pk>/observations/",
        views.ParkingAreaObservationsView.as_view(),
        name="parking-area-observations",
    ),
    path("parking/areas/<int:pk>/evidence/", views.ParkingAreaEvidenceView.as_view(), name="parking-area-evidence"),
    path("parking/map-layers/", views.MapLayersView.as_view(), name="parking-map-layers"),
    path("parking/compare/", views.CompareView.as_view(), name="parking-compare"),
    path("spots/nearby/", views.SpotsNearbyCompatView.as_view(), name="spots-nearby"),
]
