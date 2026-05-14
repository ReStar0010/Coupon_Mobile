"""WebSocket URL routing for spinner co-op."""

from __future__ import annotations

from django.urls import re_path

from .consumer import SpinnerCoopConsumer

websocket_urlpatterns = [
    re_path(r"^ws/spinner/v1/?$", SpinnerCoopConsumer.as_asgi()),
]
