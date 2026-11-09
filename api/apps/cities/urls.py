from django.urls import path

from . import views

urlpatterns = [
    path("cities/", views.CityListView.as_view(), name="city-list"),
    path("cities/<int:pk>/", views.CityDetailView.as_view(), name="city-detail"),
    path("cities/<int:pk>/coverage/", views.CityCoverageView.as_view(), name="city-coverage"),
    path("places/autocomplete/", views.AutocompleteView.as_view(), name="places-autocomplete"),
    path("places/geocode/", views.GeocodeView.as_view(), name="places-geocode"),
    path("places/reverse-geocode/", views.ReverseGeocodeView.as_view(), name="places-reverse-geocode"),
]
