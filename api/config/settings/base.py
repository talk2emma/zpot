"""Base settings shared by every environment."""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parents[2]
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env", overwrite=False)

SECRET_KEY = env("DJANGO_SECRET_KEY", default="insecure-local-only-key-0123456789abcdefghijklmn")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    "django.contrib.postgres",
    # third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    # Zpot (Part 1 implemented)
    "apps.core",
    "apps.accounts",
    "apps.cities",
    "apps.parking",
    "apps.regulations",
    "apps.availability",
    # Zpot (Part 2)
    "apps.reports",
    "apps.community",
    "apps.sessions",
    "apps.saved",
    "apps.notifications",
    "apps.support",
    "apps.privacy",
    "apps.monetization",
    "apps.scouts",
    "apps.detection",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.RequestIdMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

DATABASES = {"default": env.db("DATABASE_URL", default="postgis://zpot:zpot@localhost:5432/zpot")}
DATABASES["default"]["ATOMIC_REQUESTS"] = False
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True  # persistent connections survive a DB restart/failover
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en"
LANGUAGES = [("en", "English"), ("pt-pt", "Português (Portugal)")]
TIME_ZONE = "UTC"  # stored and computed in UTC; city-local times derive from City.timezone
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

REDIS_URL = env("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": REDIS_URL}}
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultCursorPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "apps.core.exceptions.zpot_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="120/min"),
        "user": env("THROTTLE_USER", default="300/min"),
        "auth": env("THROTTLE_AUTH", default="10/min"),
        "reports": env("THROTTLE_REPORTS", default="20/hour"),
        "verifications": env("THROTTLE_VERIFICATIONS", default="60/hour"),
        "support": env("THROTTLE_SUPPORT", default="10/hour"),
        "uploads": env("THROTTLE_UPLOADS", default="30/hour"),
        "auth_email": env("THROTTLE_AUTH_EMAIL", default="5/hour"),
    },
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=30)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Zpot API",
    "DESCRIPTION": (
        "Parking discovery and mobility intelligence for Lisbon. "
        "Free-first, evidence-based parking guidance. Development data is sample data, not live regulations."
    ),
    "VERSION": "1.0.0-part1",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "VehicleClassEnum": "apps.regulations.models.VehicleClass",
        "NotificationCategoryEnum": "apps.notifications.models.Category",
        "TicketCategoryEnum": "apps.support.models.TicketCategory",
    },
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("EMAIL_PORT", default=1025)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Zpot <no-reply@zpot.local>")
APP_LINK_BASE = env("APP_LINK_BASE", default="zpot://")
WEB_LINK_BASE = env("WEB_LINK_BASE", default="http://localhost:8000")
EMAIL_VERIFICATION_MAX_AGE_SECONDS = env.int("EMAIL_VERIFICATION_MAX_AGE_SECONDS", default=60 * 60 * 48)
PASSWORD_RESET_TIMEOUT = env.int("PASSWORD_RESET_TIMEOUT", default=60 * 60 * 2)

CELERY_BROKER_URL = REDIS_URL or "memory://"
CELERY_RESULT_BACKEND = None
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=not bool(REDIS_URL))
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_TIMEZONE = "UTC"
# A stuck task must not hold a worker forever (all Zpot tasks are short and idempotent).
CELERY_TASK_SOFT_TIME_LIMIT = env.int("CELERY_TASK_SOFT_TIME_LIMIT", default=240)
CELERY_TASK_TIME_LIMIT = env.int("CELERY_TASK_TIME_LIMIT", default=300)
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_BEAT_SCHEDULE = {
    # Reminders are persisted rows; this dispatcher is idempotent (row locks + status), so a missed
    # tick only delays delivery — it never loses or duplicates a reminder.
    "dispatch-due-reminders": {
        "task": "apps.sessions.tasks.dispatch_due_reminders",
        "schedule": 30.0,
        "options": {"expires": 25},  # a backlog of stale ticks is pointless: the next tick covers them
    },
    "expire-stale-sessions": {"task": "apps.sessions.tasks.expire_stale_sessions", "schedule": 300.0},
    "purge-expired-observations": {"task": "apps.availability.tasks.purge_expired_observations", "schedule": 900.0},
    "retention-cleanup": {"task": "apps.privacy.tasks.retention_cleanup", "schedule": 3600.0},
    "data-quality-check": {"task": "apps.core.tasks.data_quality_check", "schedule": 86400.0},
}

# Private uploads (report photos, scout evidence, privacy exports). NOT served publicly:
# files are streamed through authenticated API views only.
MEDIA_ROOT = env("MEDIA_ROOT", default=str(BASE_DIR / "media"))
UPLOAD_MAX_BYTES = env.int("UPLOAD_MAX_BYTES", default=5 * 1024 * 1024)
UPLOAD_ALLOWED_FORMATS = ("JPEG", "PNG", "WEBP")
DATA_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024

ZPOT = {
    "API_VERSION": "1",
    "MIN_SUPPORTED_APP_VERSION": "0.1.0",
    "DEFAULT_CITY_SLUG": "lisbon",
    "MAP_STYLE_URL": env("MAP_STYLE_URL", default="https://tiles.openfreemap.org/styles/liberty"),
    "GEOCODER_PROVIDER": env("GEOCODER_PROVIDER", default="local"),
    "NOMINATIM_USER_AGENT": env("NOMINATIM_USER_AGENT", default="zpot-dev/0.1"),
    "SEARCH_DEFAULTS": {
        "radius_meters": 1200,
        "max_radius_meters": 3000,
        "duration_minutes": 120,
        "max_walk_minutes": 10,
        "limit": 20,
    },
    # Walking model: straight-line distance x detour factor at average urban walking speed.
    "WALK_SPEED_M_PER_MIN": 80,
    "WALK_DETOUR_FACTOR": 1.25,
    # Community availability — provisional values, adjustable as accuracy evidence accumulates (TRD: 5–10 min).
    "OBSERVATION_TTL_MINUTES": {
        "available": env.int("OBS_TTL_AVAILABLE", default=10),
        "leaving": env.int("OBS_TTL_LEAVING", default=10),
        "occupied": env.int("OBS_TTL_OCCUPIED", default=10),
    },
    "OBSERVATION_CONFIRM_EXTENSION_MINUTES": 5,
    "OBSERVATION_RETENTION_DAYS": 7,
    # TRD hypothesis: Score = karma×0.6 + proximity×0.2 + recency×0.2 (configurable, explainable, provisional)
    "TRUST_WEIGHTS": {"karma": 0.6, "proximity": 0.2, "recency": 0.2},
    "TRUST_PUBLISH_THRESHOLD": 0.45,
    "TRUST_DEFAULT_KARMA": 0.5,
    "DUPLICATE_REPORT_RADIUS_M": 30,
    "DUPLICATE_REPORT_WINDOW_MIN": 10,
    "SESSION_EXPIRE_AFTER_HOURS": 24,
    "RESTRICTION_WARNING_MINUTES": 30,
    "PRIVACY_EXPORT_TTL_DAYS": 7,
    "SEARCH_HISTORY_RETENTION_DAYS": 90,
    "SESSION_RETENTION_DAYS": 365,
    "ZTRIGGER_EVENT_RETENTION_DAYS": 30,
    "PUSH_PROVIDER": env("PUSH_PROVIDER", default="none"),  # none = inbox only (no APNs/FCM credentials)
    "FEATURES": {
        "guest_search": True,
        "parking_search": True,
        "external_navigation": True,
        "community_reports": env.bool("FEATURE_COMMUNITY_REPORTS", default=True),
        "parking_sessions": env.bool("FEATURE_PARKING_SESSIONS", default=True),
        "saved_places_sync": True,
        "notifications": True,
        "support": True,
        "privacy_requests": True,
        "monetisation_concepts": env.bool("FEATURE_MONETISATION_CONCEPTS", default=False),
        "z_trigger": env.bool("FEATURE_Z_TRIGGER", default=False),
        "scouts": env.bool("FEATURE_SCOUTS", default=True),
        "pro": env.bool("FEATURE_PRO", default=False),
        "partners": env.bool("FEATURE_PARTNERS", default=False),
        "advertising": env.bool("FEATURE_ADVERTISING", default=False),
    },
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
    "loggers": {"django.db.backends": {"level": "WARNING"}},
}
