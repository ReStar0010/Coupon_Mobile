"""
Contract tests for Merchant Statistics API.
Feature: 009-coupon-date-cost-analytics — today_cost (今日成本), T015 [US3]
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status

from api.models import MerchantProfile, Store


class MerchantStatisticsContractTest(TestCase):
    """T015 [US3]: GET /api/merchant/statistics/ returns today_cost and optional today_cost_currency."""

    def setUp(self):
        self.client = APIClient()
        self.merchant_group, _ = Group.objects.get_or_create(name='Merchant')
        self.merchant = User.objects.create_user(
            username='merchant@stats.com',
            email='merchant@stats.com',
            password='testpass123',
        )
        self.merchant.groups.add(self.merchant_group)
        MerchantProfile.objects.create(
            user=self.merchant,
            phone='0912345678',
            contact_person='Test',
            contact_info='line@test',
        )
        Store.objects.create(
            owner=self.merchant,
            name='Test Store',
            lat=25.0,
            lng=121.0,
            address='Test',
        )

    def test_statistics_includes_today_cost(self):
        """GET /api/merchant/statistics/ with merchant auth returns 200 and includes today_cost (>= 0)."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/merchant/statistics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('today_cost', data)
        self.assertIsInstance(data['today_cost'], (int, float))
        self.assertGreaterEqual(data['today_cost'], 0)
