"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

# Set in env per environment: Backend.settings (local) | Backend.production_settings (prod) | Backend.staging_settings (staging)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.settings')

django_application = get_asgi_application()


async def application(scope, receive, send):
    """
    ASGI application that handles both lifespan and HTTP scopes.

    Django's ASGIHandler only supports HTTP connections. When using Uvicorn
    (e.g. via Gunicorn's UvicornWorker), the server sends lifespan events
    during startup/shutdown. This wrapper intercepts lifespan scopes and
    handles them, delegating HTTP to Django.
    """
    if scope["type"] == "lifespan":
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return
    else:
        await django_application(scope, receive, send)
