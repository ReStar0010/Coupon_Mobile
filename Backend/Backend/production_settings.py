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
# Backend hostnames that can receive requests (Host header)
_allowed_hosts = [
    os.environ.get('RENDER_EXTERNAL_HOSTNAME'),
    'api.coupro.pro',
]
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
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
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

# -----------------------------------------------------------------------------
# SMS (Twilio) – production
# -----------------------------------------------------------------------------
SMS_DEV_MODE = False
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
