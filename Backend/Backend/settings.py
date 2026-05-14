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

import sentry_sdk

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", ""),
    # PII disabled: JWTs and phone numbers flow through requests.
    send_default_pii=False,
    # Enable sending logs to Sentry
    enable_logs=True,
    # Sampling rates read from env so production_settings.py can lower them via .env.
    # Defaults to 1.0 (100%) in dev; production should set these to ~0.1 via env vars.
    traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "1.0")),
    profile_session_sample_rate=float(os.environ.get("SENTRY_PROFILES_SAMPLE_RATE", "1.0")),
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
# Feature flag: redirect claim/collection landing pages to the web consumer flow
# Set to True once the Web-Frontend /w/ routes are deployed
WEB_CONSUMER_FLOW_ENABLED = os.getenv('WEB_CONSUMER_FLOW_ENABLED', 'false').lower() == 'true'

# Email
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
RESEND_API_KEY = os.getenv('RESEND_API_KEY')
FROM_EMAIL = os.getenv('FROM_EMAIL', 'noreply@coupro.pro')

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
    # Channels first so its app config is loaded before Django's native ASGI
    'daphne',
    'channels',
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
    'rest_framework_simplejwt.token_blacklist',
    'storages',
    'api',
]

# ── Channels (spinner co-op WS) ─────────────────────────────────────────────
ASGI_APPLICATION = 'Backend.asgi.application'
# In-memory channel layer for dev/test. Production uses Redis (separate config).
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}

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
# Use Postgres when DATABASE_URL env var is set; otherwise fall back to SQLite.
if os.environ.get('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=0,
        ),
    }
    DATABASES['default'].setdefault('DISABLE_SERVER_SIDE_CURSORS', True)
else:
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

# -----------------------------------------------------------------------------
# Default file storage (Cloudflare R2 when credentials are present)
# -----------------------------------------------------------------------------
# When the full set of R2_* env vars is configured, route `default_storage`
# (used by `save_uploaded_image` for CouponTemplate images, etc.) through
# django-storages' S3Storage backend pointed at Cloudflare R2. Otherwise fall
# back to local `FileSystemStorage` for dev convenience.
R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME')
R2_PUBLIC_MEDIA_URL = (os.environ.get('R2_PUBLIC_MEDIA_URL') or '').rstrip('/')
if R2_PUBLIC_MEDIA_URL:
    R2_PUBLIC_MEDIA_URL = R2_PUBLIC_MEDIA_URL + '/'

_use_r2 = bool(
    R2_ACCOUNT_ID
    and R2_ACCESS_KEY_ID
    and R2_SECRET_ACCESS_KEY
    and R2_BUCKET_NAME
    and R2_PUBLIC_MEDIA_URL
)

if _use_r2:
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
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }
    MEDIA_URL = R2_PUBLIC_MEDIA_URL
else:
    STORAGES = {
        'default': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }

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
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/hour',
        'user': '1000/hour',
        'phone_registration_lookup': '20/hour',
        'redemption': '30/hour',
    },
    'EXCEPTION_HANDLER': 'api.exceptions.couPro_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
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
# Wallet / Spinner economy
# -----------------------------------------------------------------------------
# Starter gems granted on first /api/wallet/ read (writes a WalletTransaction
# of kind='seed' so it shows up in user history).
STARTER_GEMS = int(os.getenv('STARTER_GEMS', '3'))

# Solo spinner rate limit — minimum seconds between draws per user.
SOLO_SPINNER_RATE_LIMIT_SECONDS = int(os.getenv('SOLO_SPINNER_RATE_LIMIT_SECONDS', '2'))

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
        # Silence urllib3 DEBUG logs from Sentry's ingest HTTP client (Sentry still works).
        'urllib3': {'level': 'WARNING', 'propagate': False},
        'urllib3.connectionpool': {'level': 'WARNING', 'propagate': False},
    },
}
