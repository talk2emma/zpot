from django.contrib.gis import admin

from .models import ParkingObservation

admin.site.register(ParkingObservation, admin.GISModelAdmin)
