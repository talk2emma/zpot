from django.urls import path

from . import commute, views

urlpatterns = [
    path("saved/locations/", views.SavedLocationsView.as_view(), name="saved-locations"),
    path("saved/locations/import/", views.SavedLocationImportView.as_view(), name="saved-locations-import"),
    path("saved/locations/<int:pk>/", views.SavedLocationDetailView.as_view(), name="saved-location-detail"),
    path("saved/destinations/", views.SavedDestinationsView.as_view(), name="saved-destinations"),
    path("saved/destinations/<int:pk>/", views.SavedDestinationDetailView.as_view(), name="saved-destination-detail"),
    path("commute/plans/", commute.CommuteListView.as_view(), name="commute-plans"),
    path("commute/plans/<int:pk>/", commute.CommuteDetailView.as_view(), name="commute-plan-detail"),
    path("commute/plans/<int:pk>/check/", commute.CommuteCheckView.as_view(), name="commute-plan-check"),
    path("searches/recent/", views.RecentSearchesView.as_view(), name="searches-recent"),
]
