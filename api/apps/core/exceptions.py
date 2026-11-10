"""Uniform error envelope: {"error": {"code", "message", "details", "request_id"}}."""

import logging

from django.core.exceptions import PermissionDenied
from django.db import IntegrityError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ZpotAPIError(exceptions.APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "bad_request"
    default_detail = "The request could not be processed."

    def __init__(self, message=None, code=None, status_code=None, details=None):
        super().__init__(detail=message or self.default_detail, code=code or self.default_code)
        if status_code:
            self.status_code = status_code
        self.error_code = code or self.default_code
        self.details = details or {}


_CODES = {
    exceptions.ValidationError: "validation_error",
    exceptions.NotAuthenticated: "not_authenticated",
    exceptions.AuthenticationFailed: "authentication_failed",
    exceptions.PermissionDenied: "permission_denied",
    exceptions.NotFound: "not_found",
    exceptions.MethodNotAllowed: "method_not_allowed",
    exceptions.Throttled: "throttled",
    exceptions.ParseError: "parse_error",
    exceptions.UnsupportedMediaType: "unsupported_media_type",
}


log = logging.getLogger("zpot.errors")


def zpot_exception_handler(exc, context):
    if isinstance(exc, IntegrityError):
        # A uniqueness race lost to a concurrent request: a conflict, never an HTML 500. Details stay in the log only.
        log.warning("integrity conflict on %s: %s", getattr(context.get("request"), "path", "?"), exc)
        exc = ZpotAPIError(
            "This change conflicts with another request. Please try again.", code="conflict", status_code=409
        )
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()
    response = exception_handler(exc, context)
    if response is None:
        return None
    request = context.get("request")
    rid = getattr(getattr(request, "_request", request), "request_id", None)

    if isinstance(exc, ZpotAPIError):
        code, message, details = exc.error_code, str(exc.detail), exc.details
    elif isinstance(exc, exceptions.ValidationError):
        code, message, details = "validation_error", "Some fields are invalid.", response.data
    else:
        code = next((c for k, c in _CODES.items() if isinstance(exc, k)), "error")
        detail = response.data.get("detail") if isinstance(response.data, dict) else response.data
        message, details = str(detail), {}
        # simplejwt token errors carry a machine code
        if isinstance(response.data, dict) and response.data.get("code"):
            code = str(response.data["code"])
        if isinstance(exc, exceptions.Throttled) and exc.wait:
            details = {"retry_after_seconds": int(exc.wait)}
    return Response(
        {"error": {"code": code, "message": message, "details": details, "request_id": rid}},
        status=response.status_code,
        headers=dict(response.items()),
    )
