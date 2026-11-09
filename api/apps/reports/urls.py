from django.urls import path

from . import views

urlpatterns = [
    path("reports/", views.ReportListCreateView.as_view(), name="report-list"),
    path("reports/mine/", views.MyReportsView.as_view(), name="report-mine"),
    path("reports/<uuid:pk>/", views.ReportDetailView.as_view(), name="report-detail"),
    path("reports/<uuid:pk>/attachments/", views.ReportAttachmentView.as_view(), name="report-attachments"),
    path(
        "reports/<uuid:pk>/attachments/<int:attachment_id>/",
        views.ReportAttachmentDownloadView.as_view(),
        name="report-attachment-download",
    ),
    path("reports/<uuid:pk>/verifications/", views.ReportVerificationView.as_view(), name="report-verifications"),
    path("reports/<uuid:pk>/appeals/", views.ReportAppealView.as_view(), name="report-appeals"),
]
