from django.contrib.gis import admin

from .models import ParkingEvent

admin.site.register(ParkingEvent, admin.GISModelAdmin)
