from django.urls import path

from . import views

urlpatterns = [
    path("detection/config/", views.DetectionConfigView.as_view(), name="detection-config"),
    path("events/park/", views.ParkEventsView.as_view(), name="park-event-create"),
    path("events/park/<uuid:pk>/correct/", views.ParkEventCorrectView.as_view(), name="park-event-correct"),
    path(
        "events/park/<uuid:pk>/confirm/", views.ParkEventActionView.as_view(action="confirm"), name="park-event-confirm"
    ),
    path(
        "events/park/<uuid:pk>/dismiss/", views.ParkEventActionView.as_view(action="dismiss"), name="park-event-dismiss"
    ),
]
