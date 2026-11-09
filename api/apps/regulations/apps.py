from django.apps import AppConfig


class RegulationsConfig(AppConfig):
    name = "apps.regulations"
    label = "regulations"

    def ready(self):
        from . import signals  # noqa: F401
