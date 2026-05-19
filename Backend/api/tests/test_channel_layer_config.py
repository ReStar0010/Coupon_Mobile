"""
Channel-layer configuration regression tests.

Two structural invariants:
  1. Production must use a Redis-backed channel layer. InMemoryChannelLayer
     is per-process; broadcasts from worker A never reach a player on
     worker B, which silently breaks the spinner co-op lobby.
  2. Production must fail loud (RuntimeError) if REDIS_URL is missing —
     a silent fallback to in-memory would be the worst-case outcome.

We exercise the raw `Backend.production_settings` module rather than the
Django settings proxy so we can manipulate env vars between tests without
having to call `django.setup()`. Same isolation pattern as
`test_settings_defaults.py`.
"""

from __future__ import annotations

import importlib
import os
import sys
import unittest
from unittest import mock


def _reload_production_settings():
    """Re-import Backend.production_settings under the current env state."""
    sys.modules.pop('Backend.production_settings', None)
    return importlib.import_module('Backend.production_settings')


class ChannelLayerConfigTests(unittest.TestCase):
    """These tests deliberately bypass `django.conf.settings`.

    They read raw module attributes from `Backend.production_settings`
    so we can exercise its env-driven branches without poisoning the
    Django test runner's cached settings proxy.
    """

    def setUp(self):
        # Snapshot only the keys we mutate.
        self._original = {
            'REDIS_URL': os.environ.pop('REDIS_URL', None),
            'DATABASE_URL': os.environ.get('DATABASE_URL'),
            'SECRET_KEY': os.environ.get('SECRET_KEY'),
        }
        # production_settings imports dj_database_url which dies without
        # a DATABASE_URL — give it any URL just so the module loads.
        os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
        os.environ.setdefault('SECRET_KEY', 'test-key-for-channel-layer-tests')

    def tearDown(self):
        for k, v in self._original.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_serving_without_REDIS_URL_raises(self):
        # When a server entry point (gunicorn/uvicorn/daphne/runserver)
        # imports production settings without REDIS_URL set, the module
        # must raise — better than silently falling back to in-memory.
        with mock.patch.object(sys, 'argv', ['gunicorn', 'Backend.asgi:application']):
            with self.assertRaises(RuntimeError) as ctx:
                _reload_production_settings()
        self.assertIn('REDIS_URL', str(ctx.exception))

    def test_management_command_without_REDIS_URL_does_not_raise(self):
        # Critical: `manage.py migrate`, `collectstatic`, `createsuperuser`
        # etc. must load production settings without crashing when there
        # is no REDIS_URL — those commands never instantiate the channel
        # layer, so blocking them would break CI deploy pipelines.
        with mock.patch.object(sys, 'argv', ['manage.py', 'migrate']):
            mod = _reload_production_settings()  # must NOT raise
        # In-memory fallback is fine here — management commands don't use it.
        # The module simply doesn't override CHANNEL_LAYERS, leaving the
        # base settings' InMemoryChannelLayer in place.
        self.assertFalse(hasattr(mod, 'CHANNEL_LAYERS') and 'channels_redis' in str(mod.CHANNEL_LAYERS))

    def test_production_channel_layer_is_redis_when_REDIS_URL_set(self):
        os.environ['REDIS_URL'] = 'redis://localhost:6379/0'
        with mock.patch.object(sys, 'argv', ['gunicorn', 'Backend.asgi:application']):
            mod = _reload_production_settings()
        backend = mod.CHANNEL_LAYERS['default']['BACKEND']
        self.assertEqual(backend, 'channels_redis.core.RedisChannelLayer')
        # The configured URL must reach the channel layer's hosts list.
        self.assertEqual(
            mod.CHANNEL_LAYERS['default']['CONFIG']['hosts'],
            ['redis://localhost:6379/0'],
        )


class DefaultChannelLayerTests(unittest.TestCase):
    """The base settings module keeps InMemoryChannelLayer for dev / tests."""

    def test_dev_settings_use_in_memory_layer(self):
        from django.conf import settings
        self.assertEqual(
            settings.CHANNEL_LAYERS['default']['BACKEND'],
            'channels.layers.InMemoryChannelLayer',
        )
