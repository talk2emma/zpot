from .base import *  # noqa

DEBUG = False
SECRET_KEY = "test-secret-key-not-for-production-use-0123456789"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CELERY_TASK_ALWAYS_EAGER = True
CELERY_BROKER_URL = "memory://"
# every configured scope (incl. Part 2 scopes) gets a high limit in tests
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = dict.fromkeys(REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], "10000/min")  # noqa: F405

import tempfile  # noqa: E402

MEDIA_ROOT = tempfile.mkdtemp(prefix="zpot-test-media-")
