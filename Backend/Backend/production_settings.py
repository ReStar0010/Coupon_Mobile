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
# Base settings initialises Sentry with traces_sample_rate=1.0 and
# profile_session_sample_rate=1.0, which is too expensive on 0.5 CPU / 512 MB.
# Override here to 50 % so tracing remains useful without saturating the CPU.
import sentry_sdk  # noqa: E402

sentry_sdk.init(
    dsn=os.environ.get(
        "SENTRY_DSN",
        "https://c256c1e583795630acf160062b48dc0c@o4510952144961536.ingest.us.sentry.io/4510952203026432",
    ),
    send_default_pii=True,
    enable_logs=True,
    traces_sample_rate=0.5,
    profile_session_sample_rate=0.5,
    profile_lifecycle="trace",
)

# -----------------------------------------------------------------------------
# SMS (Twilio) – production
# -----------------------------------------------------------------------------
SMS_DEV_MODE = os.getenv('SMS_DEV_MODE', 'false').lower() in ('true', '1', 'yes')
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
