from django.urls import path

from . import views

urlpatterns = [path("billing/entitlement/", views.EntitlementView.as_view(), name="billing-entitlement")]
