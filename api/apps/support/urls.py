from django.urls import path

from . import views

urlpatterns = [
    path("help/articles/", views.HelpArticleListView.as_view(), name="help-articles"),
    path("help/articles/<int:pk>/", views.HelpArticleDetailView.as_view(), name="help-article-detail"),
    path("support/tickets/", views.TicketListCreateView.as_view(), name="support-tickets"),
    path("support/tickets/<uuid:pk>/", views.TicketDetailView.as_view(), name="support-ticket-detail"),
    path(
        "support/tickets/<uuid:pk>/attachments/",
        views.TicketAttachmentView.as_view(),
        name="support-ticket-attachments",
    ),
]
