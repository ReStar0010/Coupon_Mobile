"""
T008 [US3]: Tests for coupon and store endpoints.
Routes: api/store-coupons/, api/exclusive-coupons/, api/coupons/<id>/,
api/redeem/<id>/, api/unified-redemption/<code>/
"""
from unittest.mock import patch

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

    def test_exclusive_redeem_twice_returns_coupon_already_redeemed(self):
        """Second redeem for same exclusive coupon returns 400 + COUPON_ALREADY_REDEEMED."""
        redeem_code = '112233'
        self.exclusive_template.template_redeem_code = redeem_code
        self.exclusive_template.save(update_fields=['template_redeem_code'])
        self.coupon.current_holder = self.user
        self.coupon.redeem_code = redeem_code
        self.coupon.save(update_fields=['current_holder', 'redeem_code'])

        self.client.force_authenticate(user=self.user)
        url = f'/api/redeem/{self.coupon.id}/'
        body = {'redeem_code': redeem_code}
        first = self.client.post(url, body, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.post(url, body, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second.data.get('error_code'), 'COUPON_ALREADY_REDEEMED')

    def test_exclusive_redeem_integrity_error_maps_to_coupon_already_redeemed(self):
        """Simulate unique-constraint race: map IntegrityError to COUPON_ALREADY_REDEEMED."""
        redeem_code = '445566'
        self.exclusive_template.template_redeem_code = redeem_code
        self.exclusive_template.save(update_fields=['template_redeem_code'])
        self.coupon.current_holder = self.user
        self.coupon.redeem_code = redeem_code
        self.coupon.save(update_fields=['current_holder', 'redeem_code'])

        CouponRedemption.objects.create(
            coupon=self.coupon,
            user=self.user,
            savings_amount=0,
            coupon_type='exclusive',
        )
        self.client.force_authenticate(user=self.user)
        with patch.object(Coupon, 'is_redeemed', return_value=False):
            response = self.client.post(
                f'/api/redeem/{self.coupon.id}/',
                {'redeem_code': redeem_code},
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('error_code'), 'COUPON_ALREADY_REDEEMED')

    def test_exclusive_redeem_accepts_fixed_table_qr_payload(self):
        from api.models import StoreFixedSession

        fixed_session = StoreFixedSession.objects.create(
            store=self.store,
            session_token='fixed-session-token',
            is_active=True,
        )
        self.coupon.current_holder = self.user
        self.coupon.save(update_fields=['current_holder'])

        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/redeem/{self.coupon.id}/',
            {'redeem_code': f'https://api.coupro.pro/claim-fixed/{fixed_session.session_token}/'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_unified_redemption_get(self):
        """GET api/unified-redemption/<code>/ returns 200, 401, or 4xx."""
        response = self.client.get('/api/unified-redemption/INVALID_CODE/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND))
