import time

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .features import feature_flags
from .legal import legal_versions

_STARTED = time.time()


class HealthView(APIView):
    """Liveness: the process is up and serving requests. Does not touch dependencies."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    @extend_schema(
        responses=inline_serializer(
            "Health",
            {
                "status": serializers.CharField(),
                "uptime_seconds": serializers.IntegerField(),
                "version": serializers.CharField(),
            },
        )
    )
    def get(self, request):
        return Response(
            {
                "status": "ok",
                "uptime_seconds": int(time.time() - _STARTED),
                "version": settings.SPECTACULAR_SETTINGS["VERSION"],
            }
        )


def _check_database():
    with connection.cursor() as cur:
        cur.execute("SELECT 1")
        cur.execute("SELECT PostGIS_Lib_Version()")
        postgis = cur.fetchone()[0]
    executor = MigrationExecutor(connection)
    pending = executor.migration_plan(executor.loader.graph.leaf_nodes())
    return {"ok": not pending, "postgis_version": postgis, "pending_migrations": len(pending)}


def _check_cache():
    cache.set("zpot:ready-probe", "1", 5)
    return {"ok": cache.get("zpot:ready-probe") == "1", "backend": settings.CACHES["default"]["BACKEND"].split(".")[-1]}


class ReadyView(APIView):
    """Readiness: database reachable, PostGIS installed, migrations applied, cache reachable."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    @extend_schema(
        responses=inline_serializer("Ready", {"status": serializers.CharField(), "checks": serializers.DictField()})
    )
    def get(self, request):
        checks = {}
        for name, fn in (("database", _check_database), ("cache", _check_cache)):
            try:
                checks[name] = fn()
            except Exception as exc:  # noqa: BLE001 - readiness must report, not raise
                checks[name] = {"ok": False, "error": exc.__class__.__name__}
        ok = all(c.get("ok") for c in checks.values())
        return Response({"status": "ready" if ok else "not_ready", "checks": checks}, status=200 if ok else 503)


class ConfigView(APIView):
    """Public, non-secret client configuration."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        responses=inline_serializer(
            "PublicConfig",
            {
                "api_version": serializers.CharField(),
                "min_supported_app_version": serializers.CharField(),
                "default_city": serializers.CharField(),
                "map": serializers.DictField(),
                "search_defaults": serializers.DictField(),
                "data_notice": serializers.CharField(),
                "features": serializers.ListField(),
                "legal": serializers.DictField(),
            },
        )
    )
    def get(self, request):
        z = settings.ZPOT
        return Response(
            {
                "api_version": z["API_VERSION"],
                "min_supported_app_version": z["MIN_SUPPORTED_APP_VERSION"],
                "default_city": z["DEFAULT_CITY_SLUG"],
                "map": {
                    "style_url": z["MAP_STYLE_URL"],
                    "attribution": "© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors",
                },
                "search_defaults": z["SEARCH_DEFAULTS"],
                "data_notice": "Parking rules in development builds are sample data, not verified live regulations.",
                "features": feature_flags(),
                "legal": legal_versions(),
            }
        )


class FeaturesView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=inline_serializer("Features", {"features": serializers.ListField()}))
    def get(self, request):
        return Response({"features": feature_flags()})
