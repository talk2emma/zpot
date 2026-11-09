import uuid


class RequestIdMiddleware:
    """Propagates/assigns an X-Request-ID so client errors can be correlated with server logs."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request.request_id = rid[:64]
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        return response
