"""
Storage configuration tests.

Ensures that when Cloudflare R2 env vars are set, the base Django settings
route the default file storage to django-storages' S3Storage backend so
uploaded CouponTemplate images land in R2 rather than local disk.
"""
import importlib
import os
import unittest
from unittest import mock


R2_ENV = {
    'R2_ACCOUNT_ID': 'acct-test',
    'R2_ACCESS_KEY_ID': 'AKIATEST',
    'R2_SECRET_ACCESS_KEY': 'secrettest',
    'R2_BUCKET_NAME': 'test-bucket',
    'R2_PUBLIC_MEDIA_URL': 'https://pub-test.r2.dev',
}


def _reload_base_settings():
    """Reimport Backend.settings with a fresh module state."""
    import Backend.settings as base_settings
    return importlib.reload(base_settings)


class BaseSettingsStorageTest(unittest.TestCase):
    """Base `Backend.settings` must honor R2_* env vars."""

    def test_r2_envvars_activate_s3_storage_in_base_settings(self):
        """When all R2 env vars are set, base settings must select S3Storage."""
        with mock.patch.dict(os.environ, R2_ENV, clear=False):
            reloaded = _reload_base_settings()
            storages = getattr(reloaded, 'STORAGES', None)
            self.assertIsNotNone(storages, "STORAGES must be defined in base settings")
            default_backend = storages['default']['BACKEND']
            self.assertEqual(
                default_backend,
                'storages.backends.s3.S3Storage',
                "With R2_* env vars present, default storage must be S3Storage",
            )
            options = storages['default'].get('OPTIONS', {})
            self.assertEqual(options.get('bucket_name'), 'test-bucket')
            self.assertEqual(options.get('region_name'), 'auto')
            self.assertIn(
                'r2.cloudflarestorage.com',
                options.get('endpoint_url', ''),
                "endpoint_url must point at Cloudflare R2",
            )
            self.assertEqual(
                reloaded.MEDIA_URL,
                'https://pub-test.r2.dev/',
                "MEDIA_URL must be the R2 public URL with trailing slash",
            )

    def test_missing_r2_envvars_falls_back_to_filesystem(self):
        """Without R2 env vars, default storage must remain FileSystemStorage."""
        for k in R2_ENV:
            os.environ.pop(k, None)
        reloaded = _reload_base_settings()
        storages = getattr(reloaded, 'STORAGES', None)
        self.assertIsNotNone(storages, "STORAGES must be defined in base settings")
        self.assertEqual(
            storages['default']['BACKEND'],
            'django.core.files.storage.FileSystemStorage',
            "Without R2 env vars, base settings must fall back to local FS",
        )

    @classmethod
    def tearDownClass(cls):
        # Restore a clean base-settings import state so other tests see stock settings.
        for k in R2_ENV:
            os.environ.pop(k, None)
        _reload_base_settings()
        super().tearDownClass()
