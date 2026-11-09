from django.urls import path

from . import views

urlpatterns = [path("community/me/", views.MyContributionsView.as_view(), name="community-me")]
