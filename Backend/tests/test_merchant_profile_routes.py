"""
T013 [US3]: Tests for merchant profile and account routes.
Routes: api/merchant/profile/, api/merchant/profile/update/, api/merchant/statistics/,
api/merchant/account/pre-delete-check/, api/merchant/account/delete/,
api/merchant/account/deletion-status/
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status

from api.models import MerchantProfile, Store


class MerchantProfileRoutesTest(TestCase):
    """Coverage for merchant profile and account endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.merchant_group, _ = Group.objects.get_or_create(name='Merchant')
        self.merchant = User.objects.create_user(
            username='merchant@test.com',
            email='merchant@test.com',
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

    def test_profile_requires_merchant(self):
        """GET api/merchant/profile/ without merchant auth returns 401/403."""
        response = self.client.get('/api/merchant/profile/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_profile_success(self):
        """GET api/merchant/profile/ with merchant auth returns 200."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/merchant/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_profile_update_requires_merchant(self):
        """PUT api/merchant/profile/update/ without merchant returns 401/403."""
        response = self.client.put('/api/merchant/profile/update/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_statistics_requires_merchant(self):
        """GET api/merchant/statistics/ without merchant returns 401/403."""
        response = self.client.get('/api/merchant/statistics/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_pre_delete_check_success(self):
        """GET api/merchant/account/pre-delete-check/ with merchant returns 200."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/merchant/account/pre-delete-check/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_account_delete_requires_merchant(self):
        """POST api/merchant/account/delete/ without merchant returns 401/403."""
        response = self.client.post('/api/merchant/account/delete/', {
            'password': 'testpass123',
            'acknowledgments': [],
        }, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_deletion_status_requires_merchant(self):
        """GET api/merchant/account/deletion-status/ without merchant returns 401/403."""
        response = self.client.get('/api/merchant/account/deletion-status/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
