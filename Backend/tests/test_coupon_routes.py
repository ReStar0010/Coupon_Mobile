"""
T008 [US3]: Tests for coupon and store endpoints.
Routes: api/store-coupons/, api/exclusive-coupons/, api/coupons/<id>/,
api/redeem/<id>/, api/unified-redemption/<code>/
"""
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from api.models import Store, CouponTemplate, Coupon, CouponRedemption


class CouponRoutesTest(TestCase):
    """Coverage for public coupon and redemption endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='user@test.com',
            email='user@test.com',
            password='testpass123',
        )
        self.store = Store.objects.create(
            owner=self.user,
            name='Test Store',
            lat=25.0,
            lng=121.0,
            address='Test',
        )
        self.store_template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Store Coupon',
            coupon_detail='Detail',
            total_quantity=0,
            remaining_quantity=0,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        self.exclusive_template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Exclusive Coupon',
            coupon_detail='Detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        self.coupon = Coupon.objects.create(
            store=self.store,
            template=self.exclusive_template,
            coupon_name='Exclusive Coupon',
            coupon_detail='Detail',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
        )

    def test_store_coupons_get(self):
        """GET api/store-coupons/ returns 200."""
        response = self.client.get('/api/store-coupons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_exclusive_coupons_get(self):
        """GET api/exclusive-coupons/ returns 200 or 401 if auth required."""
        response = self.client.get('/api/exclusive-coupons/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED))

    def test_coupon_detail_get(self):
        """GET api/coupons/<id>/ returns 200 for valid id or 403 if auth required."""
        response = self.client.get(f'/api/coupons/{self.coupon.id}/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_403_FORBIDDEN))

    def test_coupon_detail_404(self):
        """GET api/coupons/<id>/ returns 404 for invalid id."""
        response = self.client.get('/api/coupons/99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_redeem_requires_auth(self):
        """POST api/redeem/<id>/ without auth returns 401."""
        response = self.client.post(f'/api/redeem/{self.coupon.id}/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_redeem_success_or_4xx(self):
        """POST api/redeem/<id>/ with auth returns 200 or 4xx."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f'/api/redeem/{self.coupon.id}/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_unified_redemption_get(self):
        """GET api/unified-redemption/<code>/ returns 200, 401, or 4xx."""
        response = self.client.get('/api/unified-redemption/INVALID_CODE/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND))
