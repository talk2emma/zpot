from django.urls import path

from . import views

urlpatterns = [
    path("sessions/", views.SessionListCreateView.as_view(), name="session-list"),
    path("sessions/active/", views.ActiveSessionView.as_view(), name="session-active"),
    path("sessions/<uuid:pk>/", views.SessionDetailView.as_view(), name="session-detail"),
    path("sessions/<uuid:pk>/end/", views.SessionEndView.as_view(), name="session-end"),
    path("sessions/<uuid:pk>/summary/", views.SessionSummaryView.as_view(), name="session-summary"),
    path("sessions/<uuid:pk>/reminders/", views.SessionRemindersView.as_view(), name="session-reminders"),
    path(
        "sessions/<uuid:pk>/reminders/<int:reminder_id>/",
        views.SessionReminderDeleteView.as_view(),
        name="session-reminder-delete",
    ),
]
