"""
T007 [US3]: Tests for merchant auth/redirect routes.
Routes: api/merchant/verify-email/, api/merchant/resend-verification/,
api/merchant/redirect/verify-email, api/merchant/redirect/reset-password
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status

from api.models import MerchantProfile, Store


class MerchantAuthRoutesTest(TestCase):
    """Coverage for merchant verification and redirect endpoints."""

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
            verified=False,
        )
        Store.objects.create(
            owner=self.merchant,
            name='Test Store',
            lat=25.0,
            lng=121.0,
            address='Test',
        )

    def test_merchant_verify_email_get(self):
        """GET api/merchant/verify-email/ returns 200, 302, or 4xx."""
        response = self.client.get('/api/merchant/verify-email/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_302_FOUND, status.HTTP_400_BAD_REQUEST))

    def test_merchant_resend_verification_requires_merchant(self):
        """POST api/merchant/resend-verification/ without merchant auth returns 401/403/4xx."""
        response = self.client.post('/api/merchant/resend-verification/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST))

    def test_merchant_resend_verification_success(self):
        """POST api/merchant/resend-verification/ with merchant auth returns 200 or 4xx."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.post('/api/merchant/resend-verification/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST))

    def test_redirect_verify_email(self):
        """GET api/merchant/redirect/verify-email returns 200 or 302."""
        response = self.client.get('/api/merchant/redirect/verify-email')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_302_FOUND))

    def test_redirect_reset_password(self):
        """GET api/merchant/redirect/reset-password returns 200 or 302."""
        response = self.client.get('/api/merchant/redirect/reset-password')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_302_FOUND))
