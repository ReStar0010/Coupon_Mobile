"""
Tests for login API client_type enforcement.
Merchant accounts must use client_type=merchant; user accounts must use client_type=user.
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status

from api.models import MerchantProfile, Store


class LoginClientTypeTest(TestCase):
    """Test login endpoint with client_type and wrong-client 403 responses."""

    def setUp(self):
        """Create a regular user and a merchant user."""
        self.client = APIClient()

        # Regular user (no Merchant group)
        self.regular_user = User.objects.create_user(
            username='user@example.com',
            email='user@example.com',
            password='testpass123',
        )

        # Merchant user
        self.merchant_user = User.objects.create_user(
            username='merchant@example.com',
            email='merchant@example.com',
            password='testpass123',
        )
        merchant_group, _ = Group.objects.get_or_create(name='Merchant')
        self.merchant_user.groups.add(merchant_group)
        MerchantProfile.objects.create(
            user=self.merchant_user,
            phone='0912345678',
            contact_person='Test Merchant',
            contact_info='line@test',
            verified=True,
        )
        Store.objects.create(
            owner=self.merchant_user,
            name='Test Store',
            address='Test Address',
            lat=25.0,
            lng=121.0,
        )

    def _login(self, email: str, password: str, client_type: str | None = None):
        payload = {'email': email, 'password': password}
        if client_type is not None:
            payload['client_type'] = client_type
        return self.client.post('/api/login/', payload, format='json')

    def test_login_user_with_client_type_user_succeeds(self):
        """Regular user logging in with client_type=user gets 200 and tokens."""
        response = self._login('user@example.com', 'testpass123', 'user')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('access_token', data)
        self.assertIn('refresh_token', data)

    def test_login_merchant_with_client_type_merchant_succeeds(self):
        """Merchant user logging in with client_type=merchant gets 200 and tokens."""
        response = self._login('merchant@example.com', 'testpass123', 'merchant')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('access_token', data)
        self.assertIn('refresh_token', data)

    def test_login_user_with_client_type_merchant_returns_403(self):
        """Regular user logging in with client_type=merchant gets 403 wrong_client_type."""
        response = self._login('user@example.com', 'testpass123', 'merchant')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        data = response.json()
        self.assertEqual(data.get('error'), 'wrong_client_type')
        self.assertIn('使用者端', data.get('message', ''))

    def test_login_merchant_with_client_type_user_returns_403(self):
        """Merchant user logging in with client_type=user gets 403 wrong_client_type."""
        response = self._login('merchant@example.com', 'testpass123', 'user')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        data = response.json()
        self.assertEqual(data.get('error'), 'wrong_client_type')
        self.assertIn('商家端', data.get('message', ''))

    def test_login_without_client_type_returns_400(self):
        """Login without client_type returns 400."""
        response = self._login('user@example.com', 'testpass123')  # no client_type
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn('client_type', data)

    def test_login_with_invalid_client_type_returns_400(self):
        """Login with invalid client_type returns 400."""
        response = self.client.post(
            '/api/login/',
            {'email': 'user@example.com', 'password': 'testpass123', 'client_type': 'invalid'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn('client_type', data)
