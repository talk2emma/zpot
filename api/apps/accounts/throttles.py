from rest_framework.throttling import ScopedRateThrottle


class AuthThrottle(ScopedRateThrottle):
    scope = "auth"

    def get_scope(self, view):  # noqa: D401
        return getattr(view, "throttle_scope", self.scope)
