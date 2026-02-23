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
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
SMS_DEV_MODE = os.getenv('SMS_DEV_MODE', 'true').lower() in ('true', '1', 'yes')
SECRET_KEY = os.environ.get('SECRET_KEY')  # Use a different key than production

API_BASE_URL = os.environ.get('API_BASE_URL', 'https://api.staging.coupro.pro')

_allowed_hosts = [
    os.environ.get('RENDER_EXTERNAL_HOSTNAME'),
    'api.staging.coupro.pro',
]
ALLOWED_HOSTS = [h for h in _allowed_hosts if h]