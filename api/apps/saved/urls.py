from django.urls import path

from . import views

urlpatterns = [
    path("saved/locations/", views.SavedLocationsView.as_view(), name="saved-locations"),
    path("saved/locations/import/", views.SavedLocationImportView.as_view(), name="saved-locations-import"),
    path("saved/locations/<int:pk>/", views.SavedLocationDetailView.as_view(), name="saved-location-detail"),
    path("saved/destinations/", views.SavedDestinationsView.as_view(), name="saved-destinations"),
    path("saved/destinations/<int:pk>/", views.SavedDestinationDetailView.as_view(), name="saved-destination-detail"),
    path("searches/recent/", views.RecentSearchesView.as_view(), name="searches-recent"),
]
