from django.contrib.auth import authenticate
from django.db import IntegrityError
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.exceptions import TokenError as JWTTokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from apps.core.exceptions import ZpotAPIError

from . import services
from .models import ConsentRecord, ConsentType, UserPreference
from .serializers import (
    AuthResponseSerializer,
    DeleteAccountSerializer,
    EmailSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PreferenceSerializer,
    RefreshSerializer,
    RegisterSerializer,
    TokenPairSerializer,
    TokenSerializer,
    UserSerializer,
)
from .tokens import TokenError

TOKEN_MESSAGES = {
    "token_expired": "This link has expired. Request a new one.",
    "token_invalid": "This link is not valid.",
    "token_invalid_or_expired": "This link is not valid or has expired. Request a new one.",
    "token_not_owned": "This token does not belong to your account.",
}


def _token_error(exc):
    return ZpotAPIError(TOKEN_MESSAGES.get(exc.code, "Invalid token."), code=exc.code, status_code=400)


class _AuthBase(GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RegisterView(_AuthBase):
    serializer_class = RegisterSerializer

    @extend_schema(responses={201: AuthResponseSerializer})
    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        try:
            user = services.register_user(
                email=d["email"],
                password=d["password"],
                display_name=d["display_name"],
                language=d["language"],
                accepted_terms=d["accept_terms"],
                request=request,
            )
        except IntegrityError as exc:  # race on the case-insensitive unique constraint
            raise ZpotAPIError(
                "An account with this email already exists.", code="email_taken", status_code=400
            ) from exc
        return Response(
            {"user": UserSerializer(user).data, "tokens": services.issue_tokens(user)}, status=status.HTTP_201_CREATED
        )


class LoginView(_AuthBase):
    serializer_class = LoginSerializer

    @extend_schema(responses={200: AuthResponseSerializer})
    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = authenticate(
            request, email=s.validated_data["email"].strip().lower(), password=s.validated_data["password"]
        )
        if user is None:
            raise ZpotAPIError("Email or password is incorrect.", code="invalid_credentials", status_code=401)
        return Response({"user": UserSerializer(user).data, "tokens": services.issue_tokens(user)})


class RefreshView(_AuthBase):
    serializer_class = RefreshSerializer

    @extend_schema(responses={200: TokenPairSerializer})
    def post(self, request):
        s = TokenRefreshSerializer(data=request.data)
        try:
            s.is_valid(raise_exception=True)
        except JWTTokenError as exc:
            raise ZpotAPIError(
                "Your session has expired. Sign in again.", code="token_not_valid", status_code=401
            ) from exc
        return Response({"access": s.validated_data["access"], "refresh": s.validated_data.get("refresh")})


class LogoutView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LogoutSerializer

    @extend_schema(responses={204: None})
    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            services.logout(request.user, s.validated_data.get("refresh"), s.validated_data["everywhere"])
        except JWTTokenError as exc:
            raise ZpotAPIError("Refresh token is invalid or already revoked.", code="token_not_valid") from exc
        except TokenError as exc:
            raise _token_error(exc) from exc
        return Response(status=status.HTTP_204_NO_CONTENT)


class VerifyEmailView(_AuthBase):
    serializer_class = TokenSerializer

    @extend_schema(responses={200: UserSerializer})
    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            user = services.verify_email(s.validated_data["token"])
        except TokenError as exc:
            raise _token_error(exc) from exc
        return Response(UserSerializer(user).data)


class ResendVerificationView(GenericAPIView):
    """Authenticated: resend to the signed-in user's address."""

    permission_classes = [IsAuthenticated]
    serializer_class = None
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_email"

    @extend_schema(request=None, responses={202: None})
    def post(self, request):
        if request.user.is_email_verified:
            raise ZpotAPIError("Your email is already verified.", code="already_verified", status_code=409)
        services.send_verification_email(request.user)
        return Response({"status": "sent"}, status=status.HTTP_202_ACCEPTED)


class PasswordResetView(_AuthBase):
    serializer_class = EmailSerializer
    throttle_scope = "auth_email"

    @extend_schema(responses={202: None})
    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.request_password_reset(s.validated_data["email"])
        return Response({"status": "if_account_exists_email_sent"}, status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(_AuthBase):
    serializer_class = PasswordResetConfirmSerializer

    @extend_schema(responses={200: None})
    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            services.confirm_password_reset(s.validated_data["token"], s.validated_data["new_password"])
        except TokenError as exc:
            raise _token_error(exc) from exc
        return Response({"status": "password_updated"})


class MeView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get(self, request):
        return Response(self.get_serializer(request.user).data)

    def patch(self, request):
        s = self.get_serializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(self.get_serializer(request.user).data)

    @extend_schema(request=DeleteAccountSerializer, responses={204: None})
    def delete(self, request):
        s = DeleteAccountSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        pw = s.validated_data.get("password")
        if pw is not None and not request.user.check_password(pw):
            raise ZpotAPIError("Password is incorrect.", code="invalid_credentials", status_code=403)
        services.delete_account(request.user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PreferencesView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PreferenceSerializer

    def _obj(self, request):
        obj, _ = UserPreference.objects.get_or_create(user=request.user)
        return obj

    def get(self, request):
        return Response(self.get_serializer(self._obj(request)).data)

    def patch(self, request):
        obj = self._obj(request)
        before = {"analytics": obj.analytics_opt_in, "ads": obj.personalised_ads}
        s = self.get_serializer(obj, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        # consent-bearing preferences are also written to the consent ledger
        for key, ctype, field in (
            ("analytics", ConsentType.ANALYTICS, "analytics_opt_in"),
            ("ads", ConsentType.PERSONALISED_ADS, "personalised_ads"),
        ):
            if getattr(obj, field) != before[key]:
                ConsentRecord.objects.create(user=request.user, consent_type=ctype, granted=getattr(obj, field))
        return Response(self.get_serializer(obj).data)
