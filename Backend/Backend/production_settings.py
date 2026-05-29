"""
Production deployment settings (e.g. Render).
Imports base settings and overrides for hosting, DB, CORS, cookies, static files.
"""
import os

import dj_database_url

from .settings import *  # noqa: F401, F403

# -----------------------------------------------------------------------------
# Environment & security
# -----------------------------------------------------------------------------
DEBUG = os.getenv('DEBUG', 'false').lower() in ('true', '1', 'yes')
SECRET_KEY = os.environ.get('SECRET_KEY')

API_BASE_URL = os.environ.get('API_BASE_URL', 'https://api.coupro.pro')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://app.coupro.pro')

EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND')
COOKIE_DOMAIN = '.coupro.pro'

# -----------------------------------------------------------------------------
# Hosts & CSRF
# -----------------------------------------------------------------------------
# Backend hostnames that can receive requests (Host header).
# Include internal host so same-repo services (e.g. Locust) can call this backend via private URL.
_render_internal = os.environ.get('RENDER_SERVICE_NAME')  # e.g. coupon-mobile-dev
_allowed_hosts = [
    os.environ.get('RENDER_EXTERNAL_HOSTNAME'),
    'api.coupro.pro',
]
if _render_internal:
    _allowed_hosts.append(_render_internal)
    _allowed_hosts.append(f"{_render_internal}:10000")  # Render internal HTTP port
ALLOWED_HOSTS = [h for h in _allowed_hosts if h]

# Origins allowed to submit to this backend (Origin header = frontend URL where the request came from)
# Must list frontend origin(s), not backend — e.g. page at app.coupro.pro posting to api.coupro.pro
CSRF_TRUSTED_ORIGINS = [
    'https://app.coupro.pro',
]

# -----------------------------------------------------------------------------
# Middleware (CORS first; WhiteNoise for static)
# -----------------------------------------------------------------------------
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# -----------------------------------------------------------------------------
# CORS & cookies (cross-domain, secure)
# -----------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    'https://app.coupro.pro',
]
CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'None'
CSRF_COOKIE_SAMESITE = 'None'

# -----------------------------------------------------------------------------
# HTTP security headers
# -----------------------------------------------------------------------------
# Render terminates TLS at the edge and forwards plain HTTP via the
# X-Forwarded-Proto header — Django needs the proxy hint to recognise
# the request as secure and emit HSTS. Without SECURE_PROXY_SSL_HEADER,
# SECURE_SSL_REDIRECT would loop because Django sees http:// and
# redirects to https:// over and over.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 7  # 1 week; bump to 1 year after a few clean cycles
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = False  # leave preload off until the long HSTS window is in place
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
X_FRAME_OPTIONS = 'DENY'

# -----------------------------------------------------------------------------
# Static & media storage
# -----------------------------------------------------------------------------
# R2 / default media storage is configured in base settings.py (env-driven), so
# prod only needs to override static files to use WhiteNoise's compressed backend.
STORAGES['staticfiles'] = {
    'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
}

# -----------------------------------------------------------------------------
# Database (PgBouncer-friendly)
# -----------------------------------------------------------------------------
DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL'),
        conn_max_age=0,
    ),
}
DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True
DATABASES['default']['CONN_MAX_AGE'] = 600  # reuse connections for 10 min instead of per-request

# -----------------------------------------------------------------------------
# Observability – production overrides
# -----------------------------------------------------------------------------
# Sentry is initialized in settings.py via SENTRY_DSN env var.
# Lower sampling rates for production cost control — set these in your production .env:
#   SENTRY_TRACES_SAMPLE_RATE=0.1
#   SENTRY_PROFILES_SAMPLE_RATE=0.1
# settings.py reads these env vars at startup (defaults to 1.0 when unset).

# -----------------------------------------------------------------------------
# SMS (Twilio) – production
# -----------------------------------------------------------------------------
SMS_DEV_MODE = os.getenv('SMS_DEV_MODE', 'false').lower() in ('true', '1', 'yes')
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')

# -----------------------------------------------------------------------------
# Channels — Redis channel layer (multi-worker safe)
# -----------------------------------------------------------------------------
# `InMemoryChannelLayer` is per-process; a broadcast from worker A never
# reaches a player connected to worker B. Production MUST use Redis.
#
# The fail-loud guard fires ONLY when this module is loaded by a server
# entry point (gunicorn / uvicorn / daphne / runserver) — NOT during
# `manage.py migrate`, `collectstatic`, `createsuperuser`, or a Django
# shell session. Those management commands never instantiate the channel
# layer, so requiring REDIS_URL for them would break the entire CI
# pipeline. They simply inherit the base `InMemoryChannelLayer` config,
# which is harmless for non-serving processes.
import sys as _sys

_invocation = ' '.join(_sys.argv).lower()
_is_serving = any(kw in _invocation for kw in ('gunicorn', 'uvicorn', 'daphne', 'runserver'))

_REDIS_URL = os.environ.get('REDIS_URL')

if _is_serving and not _REDIS_URL:
    raise RuntimeError(
        'REDIS_URL is required when serving HTTP/WebSocket traffic — Channels '
        'needs a Redis channel layer for multi-worker WebSocket broadcasts. '
        'Set REDIS_URL in the deploy env (Render KeyValue / Upstash both work).'
    )

if _REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [_REDIS_URL],
            },
        },
    }
# else: CHANNEL_LAYERS stays inherited from base settings.py (InMemory).
# Only management commands take this branch — they never touch Channels.
