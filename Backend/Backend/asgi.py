"""
ASGI config for backend project.

Routes:
  - HTTP        → Django (existing API)
  - WebSocket   → Channels routing → spinner_coop consumer
  - lifespan    → handled inline so Uvicorn / Daphne don't crash on startup

The spinner-coop WS lives at /ws/spinner/v1/ — see api/spinner_coop/routing.py.
"""

import os

from django.core.asgi import get_asgi_application

# Set in env per environment: Backend.settings (local) | Backend.production_settings (prod) | Backend.staging_settings (staging)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.settings')

django_application = get_asgi_application()

# Channels imports must come AFTER django_application (Django apps must be loaded first)
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from api.spinner_coop.origin import MobileFriendlyOriginValidator  # noqa: E402
from api.spinner_coop.routing import websocket_urlpatterns  # noqa: E402


# Gate the WS route by Origin. Replaces the stock
# `AllowedHostsOriginValidator` which blocked legitimate React Native
# clients (their WS sends no Origin / `Origin: null`). The custom
# validator accepts missing/null Origin (native mobile cannot be a
# CSWSH source per RFC 6455) and Origins whose host is in
# `ALLOWED_HOSTS`, rejecting everything else with close code 4403 so
# the frontend can distinguish it from the consumer's auth-fail 4401.
# See `api/spinner_coop/origin.py` for the full rationale.
_protocol_router = ProtocolTypeRouter(
    {
        "http": django_application,
        "websocket": MobileFriendlyOriginValidator(URLRouter(websocket_urlpatterns)),
    }
)


async def application(scope, receive, send):
    """ASGI entry. Handles lifespan inline; delegates HTTP/WS to the protocol router."""
    if scope["type"] == "lifespan":
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return
    else:
        await _protocol_router(scope, receive, send)
