"""
Staging settings (e.g. Render preview / staging app).
Same frontend as production (app.coupro.pro); only backend is staging (api.staging.coupro.pro).
"""
import os

from .production_settings import *  # noqa: F401, F403

# -----------------------------------------------------------------------------
# Environment & security (staging-specific)
# -----------------------------------------------------------------------------
DEBUG = os.getenv('DEBUG', 'true').lower() in ('true', '1', 'yes')  # Often True on staging for error pages
SECRET_KEY = os.environ.get('SECRET_KEY')  # Use a different key than production

# Backend: staging. Frontend: same as production (app.coupro.pro).
API_BASE_URL = os.environ.get('API_BASE_URL', 'https://api.staging.coupro.pro')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://app.coupro.pro')

# COOKIE_DOMAIN stays .coupro.pro from production_settings (same frontend)

# Optional: don't send real email on staging
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')

# -----------------------------------------------------------------------------
# Hosts (staging backend only; CORS/CSRF stay from deployment – same frontend app.coupro.pro)
# -----------------------------------------------------------------------------
_allowed_hosts = [
    os.environ.get('RENDER_EXTERNAL_HOSTNAME'),
    'api.staging.coupro.pro',
]
ALLOWED_HOSTS = [h for h in _allowed_hosts if h]

# -----------------------------------------------------------------------------
# Database (staging DB URL – use a separate DB from production)
# -----------------------------------------------------------------------------
# DATABASES is already set by production_settings from DATABASE_URL.
# Set DATABASE_URL in staging env to point to staging PostgreSQL.

# -----------------------------------------------------------------------------
# SMS – avoid sending real SMS on staging (recommended)
# -----------------------------------------------------------------------------
SMS_DEV_MODE = os.getenv('SMS_DEV_MODE', 'true').lower() in ('true', '1', 'yes')
