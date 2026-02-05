from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')

RESEND_API_KEY = os.getenv('RESEND_API_KEY')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
API_BASE_URL = os.getenv('API_BASE_URL', 'https://coupro-123.loca.lt')  # Backend API URL for email deep link redirects
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key-for-dev-only')
COOKIE_DOMAIN = None
DEBUG = True

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "192.168.0.136",
    "*.loca.lt",
    "coupro-123.loca.lt",
    "app.coupro.pro",
    "app.coupro.pro",
]

CSRF_TRUSTED_ORIGINS = [
    "https://coupro-123.loca.lt",
    "https://*.loca.lt",
    "http://localhost:8081",
    "http://192.168.0.136:8000",
]

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

WSGI_APPLICATION = 'Backend.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Taipei'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files configuration
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'images'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOWED_ORIGINS = []
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
    ]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

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
# SMS Configuration (Twilio)
# Set to True in development to log OTP to console instead of sending SMS
SMS_DEV_MODE = True

# =============================================================================
# UGC Compliance Settings (Apple Guideline 1.2)
# =============================================================================
CURRENT_EULA_VERSION = '1.0.0'
EULA_CONTENT_PATH = 'static/eula_zh.txt'
GUIDELINES_CONTENT_PATH = 'static/guidelines_zh.txt'
PRIVACY_POLICY_PATH = 'static/privacy_zh.txt'

# Moderation escalation thresholds (in hours)
ESCALATION_HOURS_WARNING = 20      # Hours before first escalation alert
ESCALATION_HOURS_CRITICAL = 24     # Hours before critical alert

# Violation and report settings
VIOLATION_SUSPENSION_THRESHOLD = 10  # Violations before suspension flag
REPORT_DUPLICATE_WINDOW_HOURS = 24   # Hours before same user can re-report same content
REPORT_RETENTION_DAYS = 7            # Days to retain resolved reports

# Admin email for escalation alerts
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'duankayne@gmail.com')
SUPPORT_EMAIL = os.getenv('SUPPORT_EMAIL', 'coupro707@gmail.com')
SUPPORT_URL = os.getenv('SUPPORT_URL', 'https://coupro-terms.vercel.app/support.html')

# Universal Links / share fallback (https://app.coupro.pro/collection/<token>)
COUPRO_PUBLIC_BASE_URL = os.getenv('COUPRO_PUBLIC_BASE_URL', 'https://app.coupro.pro')
# Optional: iOS App Store ID and Android package for fallback download links
COUPRO_APP_STORE_ID = os.getenv('COUPRO_APP_STORE_ID', '')   # e.g. 1234567890
COUPRO_PLAY_STORE_ID = os.getenv('COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
# For Universal Links: Apple Team ID (AASA) and Android SHA256 fingerprint (assetlinks.json)
COUPRO_IOS_TEAM_ID = os.getenv('COUPRO_IOS_TEAM_ID', '')     # e.g. QQ57RJ5UTD
COUPRO_ANDROID_SHA256 = os.getenv('COUPRO_ANDROID_SHA256', '')  # comma-separated if multiple
