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
# When R2 env vars are set, media files go to Cloudflare R2 (S3-compatible).
# Otherwise fall back to local disk (e.g. Render ephemeral disk).
R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME')
# Public URL for media (e.g. https://pub-xxx.r2.dev or custom domain). Must end with /
R2_PUBLIC_MEDIA_URL = (os.environ.get('R2_PUBLIC_MEDIA_URL') or '').rstrip('/')
if R2_PUBLIC_MEDIA_URL:
    R2_PUBLIC_MEDIA_URL = R2_PUBLIC_MEDIA_URL + '/'

_use_r2 = bool(R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME and R2_PUBLIC_MEDIA_URL)

if _use_r2:
    # Cloudflare R2 (S3-compatible)
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3.S3Storage',
            'OPTIONS': {
                'bucket_name': R2_BUCKET_NAME,
                'endpoint_url': f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
                'region_name': 'auto',
                'access_key': R2_ACCESS_KEY_ID,
                'secret_key': R2_SECRET_ACCESS_KEY,
                'custom_domain': R2_PUBLIC_MEDIA_URL.rstrip('/').replace('https://', '').replace('http://', '').split('/')[0],
                'querystring_auth': False,
                'file_overwrite': False,
            },
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
        },
    }
    MEDIA_URL = R2_PUBLIC_MEDIA_URL
else:
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
SMS_DEV_MODE = os.getenv('SMS_DEV_MODE', 'false').lower() in ('true', '1', 'yes')
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
