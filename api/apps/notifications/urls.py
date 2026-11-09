from django.urls import path

from . import views

urlpatterns = [
    path("notifications/", views.NotificationListView.as_view(), name="notification-list"),
    path("notifications/read-all/", views.NotificationReadAllView.as_view(), name="notification-read-all"),
    path("notifications/preferences/", views.NotificationPreferencesView.as_view(), name="notification-preferences"),
    path("notifications/<uuid:pk>/", views.NotificationDetailView.as_view(), name="notification-detail"),
    path("notifications/<uuid:pk>/read/", views.NotificationReadView.as_view(), name="notification-read"),
    path("devices/", views.DeviceListCreateView.as_view(), name="device-list"),
    path("devices/<int:pk>/", views.DeviceDetailView.as_view(), name="device-detail"),
]
