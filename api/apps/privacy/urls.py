from django.urls import path

from . import views

urlpatterns = [
    path("privacy/consents/", views.ConsentsView.as_view(), name="privacy-consents"),
    path("privacy/data-export/", views.DataExportView.as_view(), name="privacy-data-export"),
    path("privacy/deletion-request/", views.DeletionRequestView.as_view(), name="privacy-deletion"),
    path("privacy/requests/", views.PrivacyRequestListView.as_view(), name="privacy-requests"),
    path("privacy/requests/<uuid:pk>/download/", views.PrivacyRequestDownloadView.as_view(), name="privacy-download"),
]
