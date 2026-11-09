from django.contrib.gis import admin

from .models import City, Place, SupportedArea

admin.site.register(City, admin.GISModelAdmin)
admin.site.register(SupportedArea, admin.GISModelAdmin)
admin.site.register(Place, admin.GISModelAdmin)
