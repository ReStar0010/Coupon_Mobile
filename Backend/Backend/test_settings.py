"""
Test settings for merchant panel demo testing.
This configuration uses a separate test database and media directory
to ensure production data is not affected.
"""
from pathlib import Path
from .settings import *  # Import all settings from main settings.py

# Override database configuration for testing
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db_test.sqlite3',  # Separate test database
    }
}

# Override media files configuration for testing
MEDIA_ROOT = BASE_DIR / 'images_test'  # Separate test media directory

# Add test server port to allowed hosts
ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "192.168.0.136",
    "*.loca.lt",
    "coupro-123.loca.lt",
    "test.localhost",
]

# Add test server port to CSRF trusted origins
CSRF_TRUSTED_ORIGINS = [
    "https://coupro-123.loca.lt",
    "https://*.loca.lt",
    "http://localhost:8081",
    "http://localhost:8001",  # Test server port
    "http://192.168.0.136:8000",
    "http://192.168.0.136:8001",  # Test server port
]

# Print configuration info when loaded
print("=" * 60)
print("TEST SETTINGS LOADED")
print("=" * 60)
print(f"Database: {DATABASES['default']['NAME']}")
print(f"Media Root: {MEDIA_ROOT}")
print("=" * 60)

