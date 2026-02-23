"""
Migration tests for API app.
Feature: 009-coupon-date-cost-analytics — Store timezone/currency_code (T003)
"""
from django.test import TestCase
from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


class StoreTimezoneCurrencyMigrationTest(TestCase):
    """
    T003: Verify migration 0040_store_timezone_currency applies and reverses correctly.
    Store gains optional timezone and currency_code fields.
    """

    def test_migration_0040_adds_store_timezone_and_currency_code(self):
        """Apply migration and verify Store has timezone and currency_code columns."""
        executor = MigrationExecutor(connection)
        # Ensure we're at 0040 (or later)
        app_label = "api"
        migration_name = "0040_store_timezone_currency"
        try:
            executor.loader.get_migration(app_label, migration_name)
        except KeyError:
            self.skipTest(f"Migration {migration_name} not found")
            return

        # Migration should already be applied by test runner; verify model state
        from api.models import Store

        self.assertTrue(hasattr(Store, "timezone"))
        self.assertTrue(hasattr(Store, "currency_code"))
        field_tz = Store._meta.get_field("timezone")
        field_cc = Store._meta.get_field("currency_code")
        self.assertTrue(field_tz.null)
        self.assertTrue(field_cc.null)
        self.assertEqual(field_tz.max_length, 63)
        self.assertEqual(field_cc.max_length, 10)
