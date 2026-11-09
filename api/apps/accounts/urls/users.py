from django.urls import path

from apps.accounts import views

urlpatterns = [
    path("me/", views.MeView.as_view(), name="users-me"),
    path("me/preferences/", views.PreferencesView.as_view(), name="users-me-preferences"),
]
