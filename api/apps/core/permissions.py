from rest_framework.permissions import BasePermission


def has_role(user, *roles):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.roles.filter(role__in=roles).exists()


class IsReviewer(BasePermission):
    """Data reviewers / admins (moderation, scout review)."""

    def has_permission(self, request, view):
        return has_role(request.user, "data_reviewer", "admin")


class IsScout(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, "scout", "admin")


def client_token(request):
    """Opaque per-install token (X-Zpot-Client) so guests can see their own reports. Never an identity."""
    tok = (request.headers.get("X-Zpot-Client") or "").strip()
    return tok[:64] if len(tok) >= 16 else ""
