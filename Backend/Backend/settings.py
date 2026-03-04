"""
Django base settings (development / default).
Production overrides: production_settings.py
"""
from pathlib import Path
from datetime import timedelta
import os

import dj_database_url

from dotenv import load_dotenv

load_dotenv()
# BASE_DIR is set below; load Backend/.env after paths are available (see end of Paths section)
import logging

import sentry_sdk

sentry_sdk.init(
    dsn="https://c256c1e583795630acf160062b48dc0c@o4510952144961536.ingest.us.sentry.io/4510952203026432",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    # Enable sending logs to Sentry
    enable_logs=True,
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,
    # Set profile_session_sample_rate to 1.0 to profile 100%
    # of profile sessions.
    profile_session_sample_rate=1.0,
    # Set profile_lifecycle to "trace" to automatically
    # run the profiler on when there is an active transaction
    profile_lifecycle="trace",
)

# -----------------------------------------------------------------------------
# Paths & environment
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')  # Backend/.env (optional, for local Postgres etc.)

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key-for-dev-only')
DEBUG = True
COOKIE_DOMAIN = None

# URLs (backend API, frontend, public app)
API_BASE_URL = os.getenv('API_BASE_URL', 'https://coupro-123.loca.lt')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://app.coupro.pro')

# Email
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
RESEND_API_KEY = os.getenv('RESEND_API_KEY')

# Admin & support
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'duankayne@gmail.com')
SUPPORT_EMAIL = os.getenv('SUPPORT_EMAIL', 'coupro707@gmail.com')
SUPPORT_URL = os.getenv('SUPPORT_URL', 'https://coupro-terms.vercel.app/support.html')

# App store / Universal Links (optional)
COUPRO_APP_STORE_ID = os.getenv('COUPRO_APP_STORE_ID', '')
COUPRO_PLAY_STORE_ID = os.getenv('COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
COUPRO_IOS_TEAM_ID = os.getenv('COUPRO_IOS_TEAM_ID', '')
COUPRO_ANDROID_SHA256 = os.getenv('COUPRO_ANDROID_SHA256', '')

# -----------------------------------------------------------------------------
# Hosts & security
# -----------------------------------------------------------------------------
# Backend hostnames that can receive requests (Host header)
ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '192.168.0.136',
    '*.loca.lt',
    'coupro-123.loca.lt',
    'api.coupro.pro',
    'app.coupro.pro',
    'coupon-mobile-dev',
    'coupon-mobile-dev:10000',
]

# Origins allowed to submit to this backend (frontend URLs where requests come from)
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://192.168.0.136:3000',
    'https://app.coupro.pro',
]

# -----------------------------------------------------------------------------
# Django core
# -----------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'drf_yasg',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'Backend.urls'
WSGI_APPLICATION = 'Backend.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
# Use Postgres when DATABASE_URL is set and reachable; otherwise SQLite.
def _postgres_available():
    """Return True if DATABASE_URL points to a reachable PostgreSQL instance."""
    if not os.environ.get('DATABASE_URL'):
        return False
    try:
        import psycopg2
        conn = psycopg2.connect(
            os.environ.get('DATABASE_URL'),
            connect_timeout=2,
        )
        conn.close()
        return True
    except Exception:
        return False


if _postgres_available():
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=0,
        ),
    }
    DATABASES['default'].setdefault('DISABLE_SERVER_SIDE_CURSORS', True)
else:
    if os.environ.get('DATABASE_URL'):
        logging.getLogger(__name__).info(
            'PostgreSQL unreachable (DATABASE_URL set); using SQLite.'
        )
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        },
    }

# -----------------------------------------------------------------------------
# Auth & passwords
# -----------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# -----------------------------------------------------------------------------
# Internationalization & static/media
# -----------------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Taipei'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'images'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# -----------------------------------------------------------------------------
# CORS
# -----------------------------------------------------------------------------
CORS_ALLOW_CREDENTIALS = True

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOWED_ORIGINS = []
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [
        'http://localhost:3000',
    ]

CORS_ALLOW_METHODS = [
    'DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# -----------------------------------------------------------------------------
# REST Framework & JWT
# -----------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'api.auth.CookieJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=10),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# -----------------------------------------------------------------------------
# SMS (Twilio)
# -----------------------------------------------------------------------------
# True in dev: log OTP to console instead of sending SMS
SMS_DEV_MODE = True

# -----------------------------------------------------------------------------
# UGC compliance (Apple Guideline 1.2)
# -----------------------------------------------------------------------------
CURRENT_EULA_VERSION = '1.0.0'
EULA_CONTENT_PATH = 'static/eula_zh.txt'
GUIDELINES_CONTENT_PATH = 'static/guidelines_zh.txt'
PRIVACY_POLICY_PATH = 'static/privacy_zh.txt'

# Moderation escalation (hours)
ESCALATION_HOURS_WARNING = 20
ESCALATION_HOURS_CRITICAL = 24

# Violations & reports
VIOLATION_SUSPENSION_THRESHOLD = 10
REPORT_DUPLICATE_WINDOW_HOURS = 24
REPORT_RETENTION_DAYS = 7

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
# Sentry's LoggingIntegration (enabled by default) captures:
#   - Breadcrumbs for INFO+ logs
#   - Sentry error events for ERROR+ logs
# This LOGGING config controls what Python emits to the console and Sentry.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO' if not DEBUG else 'DEBUG',
    },
    'loggers': {
        'api': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
