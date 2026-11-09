from rest_framework import serializers

from .models import City, SupportedArea


class PointSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class CitySerializer(serializers.ModelSerializer):
    center = serializers.SerializerMethodField()
    bbox = serializers.SerializerMethodField()

    class Meta:
        model = City
        fields = [
            "id",
            "slug",
            "name",
            "country_code",
            "timezone",
            "currency",
            "is_supported",
            "launch_note",
            "center",
            "bbox",
        ]

    def get_center(self, obj) -> dict:
        return {"latitude": obj.center.y, "longitude": obj.center.x}

    def get_bbox(self, obj) -> list[float] | None:
        return list(obj.boundary.extent) if obj.boundary else None


class SupportedAreaSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()

    class Meta:
        model = SupportedArea
        fields = ["slug", "name", "coverage", "coverage_note", "geometry"]

    def get_geometry(self, obj) -> dict:
        import json

        return json.loads(obj.boundary.geojson)


class PlaceResultSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    subtitle = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    kind = serializers.CharField()
    provider = serializers.CharField()
    coverage = serializers.DictField(required=False)


class AutocompleteQuerySerializer(serializers.Serializer):
    q = serializers.CharField(min_length=1, max_length=120)
    city = serializers.SlugField(required=False, default="lisbon")
    limit = serializers.IntegerField(required=False, min_value=1, max_value=20, default=8)
    latitude = serializers.FloatField(required=False, min_value=-90, max_value=90)
    longitude = serializers.FloatField(required=False, min_value=-180, max_value=180)


class GeocodeQuerySerializer(serializers.Serializer):
    q = serializers.CharField(min_length=1, max_length=200)
    city = serializers.SlugField(required=False, default="lisbon")


class ReverseQuerySerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
