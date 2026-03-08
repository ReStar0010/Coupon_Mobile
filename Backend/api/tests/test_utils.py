"""
Unit tests for api.utils (phone validation, masking, redemption code, store timezone/currency).
"""
from datetime import date

from django.test import TestCase
from django.contrib.auth.models import User

from api.utils import (
    validate_phone_number,
    mask_phone_number,
    generate_unified_redemption_code,
    get_store_today,
    get_store_currency_code,
)
from api.models import Store


class ValidatePhoneNumberTest(TestCase):
    """Tests for validate_phone_number."""

    def test_valid_plain_returns_normalized(self):
        self.assertEqual(validate_phone_number('0912345678'), '0912345678')

    def test_valid_with_spaces_returns_normalized(self):
        self.assertEqual(validate_phone_number('09 1234 5678'), '0912345678')

    def test_valid_with_dashes_returns_normalized(self):
        self.assertEqual(validate_phone_number('09-1234-5678'), '0912345678')

    def test_empty_raises_value_error(self):
        with self.assertRaises(ValueError) as ctx:
            validate_phone_number('')
        self.assertIn('empty', str(ctx.exception).lower())

    def test_none_raises_value_error(self):
        with self.assertRaises(ValueError):
            validate_phone_number(None)

    def test_invalid_prefix_raises_value_error(self):
        with self.assertRaises(ValueError) as ctx:
            validate_phone_number('0812345678')
        self.assertIn('Invalid phone number format', str(ctx.exception))

    def test_invalid_length_raises_value_error(self):
        with self.assertRaises(ValueError):
            validate_phone_number('091234567')

    def test_non_taiwan_format_raises_value_error(self):
        with self.assertRaises(ValueError):
            validate_phone_number('1234567890')


class MaskPhoneNumberTest(TestCase):
    """Tests for mask_phone_number."""

    def test_normal_length_returns_masked(self):
        self.assertEqual(mask_phone_number('0912345678'), '0912****78')

    def test_short_string_returns_unchanged(self):
        self.assertEqual(mask_phone_number('12345'), '12345')

    def test_empty_returns_unchanged(self):
        self.assertEqual(mask_phone_number(''), '')


class GenerateUnifiedRedemptionCodeTest(TestCase):
    """Tests for generate_unified_redemption_code."""

    def test_returns_length_six(self):
        code = generate_unified_redemption_code()
        self.assertEqual(len(code), 6)

    def test_returns_all_digits(self):
        code = generate_unified_redemption_code()
        self.assertTrue(code.isdigit(), f'expected all digits, got {code!r}')

    def test_multiple_calls_produce_digits(self):
        for _ in range(5):
            code = generate_unified_redemption_code()
            self.assertEqual(len(code), 6)
            self.assertTrue(code.isdigit())


class GetStoreTodayTest(TestCase):
    """Tests for get_store_today."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner@test.com',
            email='owner@test.com',
            password='testpass123',
        )

    def test_store_with_timezone_returns_date(self):
        store = Store.objects.create(
            owner=self.owner,
            name='Test',
            lat=25.0,
            lng=121.0,
            address='Test',
            timezone='Asia/Taipei',
        )
        result = get_store_today(store)
        self.assertIsInstance(result, date)

    def test_store_without_timezone_returns_date(self):
        store = Store.objects.create(
            owner=self.owner,
            name='Test',
            lat=25.0,
            lng=121.0,
            address='Test',
        )
        result = get_store_today(store)
        self.assertIsInstance(result, date)

    def test_store_with_utc_returns_date(self):
        store = Store.objects.create(
            owner=self.owner,
            name='Test',
            lat=25.0,
            lng=121.0,
            address='Test',
            timezone='UTC',
        )
        result = get_store_today(store)
        self.assertIsInstance(result, date)


class GetStoreCurrencyCodeTest(TestCase):
    """Tests for get_store_currency_code."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner@test.com',
            email='owner@test.com',
            password='testpass123',
        )

    def test_store_with_currency_returns_code(self):
        store = Store.objects.create(
            owner=self.owner,
            name='Test',
            lat=25.0,
            lng=121.0,
            address='Test',
            currency_code='TWD',
        )
        self.assertEqual(get_store_currency_code(store), 'TWD')

    def test_store_without_currency_returns_none(self):
        store = Store.objects.create(
            owner=self.owner,
            name='Test',
            lat=25.0,
            lng=121.0,
            address='Test',
        )
        self.assertIsNone(get_store_currency_code(store))
