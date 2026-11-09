from django.urls import path

from . import views

urlpatterns = [
    path("scouts/assignments/", views.AssignmentListView.as_view(), name="scout-assignments"),
    path("scouts/assignments/<int:pk>/", views.AssignmentDetailView.as_view(), name="scout-assignment-detail"),
    path("scouts/assignments/<int:pk>/submit/", views.AssignmentSubmitView.as_view(), name="scout-assignment-submit"),
]
