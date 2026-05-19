"""
Regression tests for safe defaults in the base Django settings module.

These guard against the classic "forgot DJANGO_SETTINGS_MODULE=production"
deploy footgun: a base settings module that hardcodes DEBUG=True would
leak tracebacks to the public if the production overlay is missed. We
make the base default to env-driven false so the worst-case fallback is
"harder to debug" rather than "info disclosure".
"""

import importlib
import os
import sys
import unittest


def _reload_base_settings():
    """Reload Backend.settings with the current env state.

    We can't simply `from django.conf import settings` here because Django
    caches the active settings module at import time. We instead reload
    the *raw* settings module and read its module-level attributes.
    """
    if 'Backend.settings' in sys.modules:
        del sys.modules['Backend.settings']
    return importlib.import_module('Backend.settings')


class BaseSettingsDefaultsTests(unittest.TestCase):
    """Read raw module attributes from `Backend.settings`.

    These tests intentionally bypass `django.conf.settings` (the lazy
    proxy) so we can exercise the env-driven default chain directly.
    They must NOT call `django.setup()` or leave a partially-reloaded
    module in `sys.modules` for later tests — only env-var state is
    restored in tearDown.
    """

    def setUp(self):
        # Snapshot env so each test sees a known starting state.
        self._original_debug = os.environ.pop('DEBUG', None)

    def tearDown(self):
        # Restore env only. Do NOT reload `Backend.settings` in tearDown:
        # a final reload would leave a "clean" module in sys.modules that
        # later tests doing `from Backend.settings import X` could pick
        # up, missing state established at `django.setup()` time.
        if self._original_debug is None:
            os.environ.pop('DEBUG', None)
        else:
            os.environ['DEBUG'] = self._original_debug

    def test_debug_defaults_to_false_when_env_unset(self):
        """Safe-by-default: no env var → DEBUG is False."""
        mod = _reload_base_settings()
        self.assertFalse(mod.DEBUG)

    def test_debug_true_when_env_set_to_true(self):
        os.environ['DEBUG'] = 'true'
        mod = _reload_base_settings()
        self.assertTrue(mod.DEBUG)

    def test_debug_true_for_truthy_aliases(self):
        for value in ('TRUE', 'True', '1', 'yes', 'YES'):
            os.environ['DEBUG'] = value
            mod = _reload_base_settings()
            self.assertTrue(mod.DEBUG, f'DEBUG should be truthy for {value!r}')

    def test_debug_false_for_other_strings(self):
        for value in ('false', 'no', '0', '', 'maybe'):
            os.environ['DEBUG'] = value
            mod = _reload_base_settings()
            self.assertFalse(mod.DEBUG, f'DEBUG should be falsy for {value!r}')
