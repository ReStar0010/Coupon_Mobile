"""
Contract tests for Template Analytics API endpoint.
Feature: 004-analytics-count-view
Tests: T005-T009
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta
from django.utils import timezone

from api.models import Store, CouponTemplate, Coupon, CouponRedemption, Log


class TemplateAnalyticsContractTestBase(TestCase):
    """Base test class with common setup for template analytics contract tests."""

    def setUp(self):
        """Set up test fixtures."""
        # Create merchant user and add to Merchants group
        self.merchant_user = User.objects.create_user(
            username='merchant@example.com',
            email='merchant@example.com',
            password='testpass123'
        )
        merchant_group, _ = Group.objects.get_or_create(name='Merchants')
        self.merchant_user.groups.add(merchant_group)

        # Create store
        self.store = Store.objects.create(
            owner=self.merchant_user,
            name='Test Store',
            lat=25.0,
            lng=121.0,
            address='Test Address'
        )

        # Create exclusive template (total_quantity > 0)
        self.exclusive_template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Exclusive Test Coupon',
            coupon_detail='Test detail',
            total_quantity=100,  # Exclusive template
            remaining_quantity=100,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30)
        )

        # Create store template (EasyUse - total_quantity == 0)
        self.store_template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Store Test Coupon',
            coupon_detail='Test detail',
            total_quantity=0,  # Store template (EasyUse)
            remaining_quantity=0,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30)
        )

        # Create some test data for exclusive template
        # Create coupons with different acquisition methods
        self.consolidate_coupon = Coupon.objects.create(
            store=self.store,
            template=self.exclusive_template,
            coupon_name='Consolidate Coupon',
            coupon_detail='Test',
            start_date=timezone.now() - timedelta(days=10),
            expiry_date=timezone.now() + timedelta(days=20),
            coupon_type='exclusive',
            acquisition_method='consolidate'
        )

        self.transfer_coupon = Coupon.objects.create(
            store=self.store,
            template=self.exclusive_template,
            coupon_name='Transfer Coupon',
            coupon_detail='Test',
            start_date=timezone.now() - timedelta(days=10),
            expiry_date=timezone.now() + timedelta(days=20),
            coupon_type='exclusive',
            acquisition_method='transfer'
        )

        # Create test user for redemptions
        self.test_user = User.objects.create_user(
            username='testuser@example.com',
            email='testuser@example.com',
            password='testpass123'
        )

        # Create redemptions
        CouponRedemption.objects.create(
            coupon=self.consolidate_coupon,
            user=self.test_user,
            redeemed_at=timezone.now() - timedelta(days=5)
        )

        CouponRedemption.objects.create(
            coupon=self.transfer_coupon,
            user=self.test_user,
            redeemed_at=timezone.now() - timedelta(days=3)
        )

        # Create view logs
        Log.objects.create(
            template=self.exclusive_template,
            action='template_view',
            timestamp=timezone.now() - timedelta(days=7)
        )

        # Set up API client
        self.client = APIClient()
        self.client.force_authenticate(user=self.merchant_user)


class TemplateAnalyticsContractTests(TemplateAnalyticsContractTestBase):
    """Contract tests for template analytics API response schema."""

    def test_exclusive_template_response_includes_count_fields(self):
        """
        T006: Contract test for exclusive template API response includes count fields.
        Verifies that exclusive templates return all five count fields:
        - retention_count
        - stranger_acquisition_count
        - redemption_count
        - circulation_count
        - circulation_redemption_count
        """
        response = self.client.get(
            f'/api/merchant/coupon-templates/{self.exclusive_template.id}/analytics/?days=30'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Verify count fields are present
        self.assertIn('retention_count', data)
        self.assertIn('stranger_acquisition_count', data)
        self.assertIn('redemption_count', data)
        self.assertIn('circulation_count', data)
        self.assertIn('circulation_redemption_count', data)

        # Verify count fields are integers
        self.assertIsInstance(data['retention_count'], int)
        self.assertIsInstance(data['stranger_acquisition_count'], int)
        self.assertIsInstance(data['redemption_count'], int)
        self.assertIsInstance(data['circulation_count'], int)
        self.assertIsInstance(data['circulation_redemption_count'], int)

    def test_store_template_response_excludes_exclusive_count_fields(self):
        """
        T007: Contract test for store template API response excludes exclusive-only count fields.
        Verifies that store templates (EasyUse) do NOT return exclusive-only count fields.
        """
        response = self.client.get(
            f'/api/merchant/coupon-templates/{self.store_template.id}/analytics/?days=30'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Verify exclusive-only count fields are NOT present
        self.assertNotIn('retention_count', data)
        self.assertNotIn('stranger_acquisition_count', data)
        self.assertNotIn('redemption_count', data)
        self.assertNotIn('circulation_count', data)
        self.assertNotIn('circulation_redemption_count', data)

        # Verify store template still has exposure_count
        self.assertIn('exposure_count', data)

    def test_count_field_types_are_integers_non_negative(self):
        """
        T008: Contract test for count field types are integers >= 0.
        Verifies that all count fields are non-negative integers.
        """
        response = self.client.get(
            f'/api/merchant/coupon-templates/{self.exclusive_template.id}/analytics/?days=30'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Verify all count fields are integers >= 0
        count_fields = [
            'retention_count',
            'stranger_acquisition_count',
            'redemption_count',
            'circulation_count',
            'circulation_redemption_count'
        ]

        for field in count_fields:
            self.assertIn(field, data)
            self.assertIsInstance(data[field], int)
            self.assertGreaterEqual(data[field], 0, f"{field} should be >= 0")

    def test_trend_daily_data_contains_count_values(self):
        """
        T009: Contract test for trend daily_data contains count values for count metrics.
        Verifies that trend data includes count values in daily_data arrays.
        Note: The daily_data values for rate metrics should contain count values
        when accessed for count view (as per research.md R2).
        """
        response = self.client.get(
            f'/api/merchant/coupon-templates/{self.exclusive_template.id}/analytics/?days=30'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Verify trends structure exists
        self.assertIn('trends', data)
        self.assertIsInstance(data['trends'], dict)

        # Verify retention_rate trend has daily_data with count values
        if 'retention_rate' in data.get('trends', {}):
            trend = data['trends']['retention_rate']
            self.assertIn('daily_data', trend)
            self.assertIsInstance(trend['daily_data'], list)

            # Verify daily_data items have date and value
            if trend['daily_data']:
                for day_data in trend['daily_data']:
                    self.assertIn('date', day_data)
                    self.assertIn('value', day_data)
                    # Value should be a number (can be int or float, but for count view it's int)
                    self.assertIsInstance(day_data['value'], (int, float))
                    # For count values, should be >= 0
                    if isinstance(day_data['value'], int):
                        self.assertGreaterEqual(day_data['value'], 0)

        # Verify stranger_acquisition_rate trend has daily_data
        if 'stranger_acquisition_rate' in data.get('trends', {}):
            trend = data['trends']['stranger_acquisition_rate']
            self.assertIn('daily_data', trend)
            self.assertIsInstance(trend['daily_data'], list)

        # Verify circulation_rate trend has daily_data
        if 'circulation_rate' in data.get('trends', {}):
            trend = data['trends']['circulation_rate']
            self.assertIn('daily_data', trend)
            self.assertIsInstance(trend['daily_data'], list)

        # Verify circulation_redemption_rate trend has daily_data
        if 'circulation_redemption_rate' in data.get('trends', {}):
            trend = data['trends']['circulation_redemption_rate']
            self.assertIn('daily_data', trend)
            self.assertIsInstance(trend['daily_data'], list)

        # Verify redemption_rate trend has daily_data
        if 'redemption_rate' in data.get('trends', {}):
            trend = data['trends']['redemption_rate']
            self.assertIn('daily_data', trend)
            self.assertIsInstance(trend['daily_data'], list)
