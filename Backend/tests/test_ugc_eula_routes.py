"""
T015 [US3]: Tests for UGC/content and EULA routes.
Routes: api/content/.../report/, api/content/.../report/status/, api/user/reports/,
api/user/blocked-merchants/, api/store/<id>/block-status/, api/merchant/eula/status/,
api/merchant/eula/accept/, api/merchant/eula/content/, api/content-guidelines/,
api/privacy-policy/
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from api.models import MerchantProfile, Store, CouponTemplate


class UGCEulaRoutesTest(TestCase):
    """Coverage for content reporting, blocking, EULA and public legal content."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='user@test.com',
            email='user@test.com',
            password='testpass123',
        )
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
        self.store = Store.objects.create(
            owner=self.merchant,
            name='Test Store',
            lat=25.0,
            lng=121.0,
            address='Test',
        )
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Test',
            coupon_detail='Detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
        )

    def test_report_content_requires_auth(self):
        """POST api/content/<type>/<id>/report/ without auth returns 401."""
        response = self.client.post(
            f'/api/content/coupon_template/{self.template.id}/report/',
            {'reason': 'spam'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_report_status_requires_auth(self):
        """GET api/content/<type>/<id>/report/status/ without auth returns 401."""
        response = self.client.get(
            f'/api/content/coupon_template/{self.template.id}/report/status/',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_reports_requires_auth(self):
        """GET api/user/reports/ without auth returns 401."""
        response = self.client.get('/api/user/reports/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_merchants_requires_auth(self):
        """GET api/user/blocked-merchants/ without auth returns 401."""
        response = self.client.get('/api/user/blocked-merchants/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_block_status_requires_auth(self):
        """GET api/store/<id>/block-status/ without auth returns 401."""
        response = self.client.get(f'/api/store/{self.store.id}/block-status/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_eula_status_requires_merchant(self):
        """GET api/merchant/eula/status/ without merchant returns 401/403."""
        response = self.client.get('/api/merchant/eula/status/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_eula_accept_requires_merchant(self):
        """POST api/merchant/eula/accept/ without merchant returns 401/403."""
        response = self.client.post('/api/merchant/eula/accept/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_eula_content_requires_merchant(self):
        """GET api/merchant/eula/content/ without merchant returns 401/403."""
        response = self.client.get('/api/merchant/eula/content/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_content_guidelines_public(self):
        """GET api/content-guidelines/ returns 200 (public)."""
        response = self.client.get('/api/content-guidelines/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_privacy_policy_public(self):
        """GET api/privacy-policy/ returns 200 (public)."""
        response = self.client.get('/api/privacy-policy/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
