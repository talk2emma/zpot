from django.urls import path

from . import views

urlpatterns = [
    path("", views.RegulationListView.as_view(), name="regulation-list"),
    path("<int:pk>/", views.RegulationDetailView.as_view(), name="regulation-detail"),
    path("evaluate/", views.EvaluateView.as_view(), name="regulation-evaluate"),
    path("closures/", views.ClosureListView.as_view(), name="regulation-closures"),
]
