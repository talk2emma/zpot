"""Minimal web fallback pages for email links (for devices where the zpot:// deep link can't open)."""

from django.conf import settings
from django.http import HttpResponse
from django.utils.html import escape

from . import services
from .tokens import TokenError

_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zpot</title><style>body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:48px auto;padding:0 20px;color:#00233D}}
a.btn{{display:block;text-align:center;background:#63BB02;color:#00233D;font-weight:700;padding:16px;border-radius:14px;text-decoration:none;margin-top:16px}}</style></head>
<body><h1>{title}</h1><p>{body}</p>{extra}</body></html>"""


def verify_email_page(request):
    token = request.GET.get("token", "")
    try:
        services.verify_email(token)
        title, body = "Email confirmed", "Your Zpot email address is confirmed. You can return to the app."
    except TokenError as exc:
        title = "Link not valid"
        body = "This link has expired." if exc.code == "token_expired" else "This verification link isn't valid."
    link = f'<a class="btn" href="{escape(settings.APP_LINK_BASE)}verify-email?token={escape(token)}">Open Zpot</a>'
    return HttpResponse(_PAGE.format(title=title, body=body, extra=link))


def reset_password_page(request):
    token = request.GET.get("token", "")
    link = f'<a class="btn" href="{escape(settings.APP_LINK_BASE)}reset-password?token={escape(token)}">Open Zpot to set a new password</a>'
    return HttpResponse(
        _PAGE.format(
            title="Reset your password", body="Open this link on the phone where Zpot is installed.", extra=link
        )
    )
