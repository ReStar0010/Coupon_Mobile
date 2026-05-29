"""
Integration tests for coupon redemption flows.
Routes: api/redeem/<id>/, api/store-coupons/, api/exclusive-coupons/
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    Coupon,
    CouponRedemption,
    CouponTemplate,
    Store,
    StudentProfile,
)


class CouponRedemptionTests(TestCase):
    """Integration tests for exclusive coupon redemption."""

    def setUp(self):
        self.client = APIClient()

        # Primary user (coupon holder)
        self.user = User.objects.create_user(
            username='holder@test.com',
            email='holder@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=self.user, verified=True)

        # Second user (must not be allowed to redeem another user's coupon)
        self.other_user = User.objects.create_user(
            username='other@test.com',
            email='other@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=self.other_user, verified=True)

        # Store and template
        self.store = Store.objects.create(
            owner=self.user,
            name='Redemption Store',
            lat=25.0,
            lng=121.0,
            address='123 Test Road',
        )
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Exclusive Deal',
            coupon_detail='10% off',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now() - timedelta(hours=1),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
            template_redeem_code='CODE01',
        )

        # An exclusive coupon assigned to self.user
        self.coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='Exclusive Deal',
            coupon_detail='10% off',
            start_date=timezone.now() - timedelta(hours=1),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
            redeem_code='CODE01',
            original_owner=self.user,
            current_holder=self.user,
        )

        self.client.force_authenticate(user=self.user)

    def test_redeem_exclusive_coupon_success(self):
        """POST api/redeem/<id>/ with the correct code returns 200."""
        response = self.client.post(
            f'/api/redeem/{self.coupon.id}/',
            {'redeem_code': 'CODE01'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(CouponRedemption.objects.filter(coupon=self.coupon, user=self.user).exists())

    def test_redeem_exclusive_coupon_wrong_user(self):
        """POST api/redeem/<id>/ by a user who is not the holder returns 4xx."""
        self.client.force_authenticate(user=self.other_user)
        response = self.client.post(
            f'/api/redeem/{self.coupon.id}/',
            {'redeem_code': 'CODE01'},
            format='json',
        )
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_redeem_already_redeemed(self):
        """POST api/redeem/<id>/ a second time returns 4xx (already redeemed)."""
        # First redemption
        CouponRedemption.objects.create(
            coupon=self.coupon,
            user=self.user,
            savings_amount=0,
            coupon_type='exclusive',
        )
        response = self.client.post(
            f'/api/redeem/{self.coupon.id}/',
            {'redeem_code': 'CODE01'},
            format='json',
        )
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_redeem_expired_coupon(self):
        """POST api/redeem/<id>/ for an expired coupon still processes redemption
        (expiry is not enforced at redemption time in this API — only listing filters)."""
        expired_coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='Expired',
            coupon_detail='detail',
            start_date=timezone.now() - timedelta(days=60),
            expiry_date=timezone.now() - timedelta(days=1),
            coupon_type='exclusive',
            acquisition_method='consolidate',
            redeem_code='CODE01',
            original_owner=self.user,
            current_holder=self.user,
        )
        response = self.client.post(
            f'/api/redeem/{expired_coupon.id}/',
            {'redeem_code': 'CODE01'},
            format='json',
        )
        # Expiry enforcement: accept either success or 4xx (implementation-dependent)
        self.assertIn(response.status_code, (
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
        ))

    def test_redeem_exclusive_wrong_code(self):
        """POST api/redeem/<id>/ with an incorrect redeem code returns 4xx."""
        response = self.client.post(
            f'/api/redeem/{self.coupon.id}/',
            {'redeem_code': 'WRONG1'},
            format='json',
        )
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_redeem_exclusive_missing_code(self):
        """POST api/redeem/<id>/ without a redeem_code field returns 4xx."""
        response = self.client.post(
            f'/api/redeem/{self.coupon.id}/',
            {},
            format='json',
        )
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_redeem_requires_auth(self):
        """POST api/redeem/<id>/ without authentication returns 401."""
        self.client.force_authenticate(user=None)
        response = self.client.post(
            f'/api/redeem/{self.coupon.id}/',
            {'redeem_code': 'CODE01'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class GetStoreCouponsTests(TestCase):
    """Integration tests for GET api/store-coupons/ (public listing)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='merchant2@test.com',
            email='merchant2@test.com',
            password='testpass123',
        )
        self.store = Store.objects.create(
            owner=self.user,
            name='Public Store',
            lat=25.0,
            lng=121.0,
            address='456 Test Ave',
        )
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Store Coupon',
            coupon_detail='Free item',
            total_quantity=0,
            remaining_quantity=0,
            start_date=timezone.now() - timedelta(hours=1),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        # store-type coupon (total_quantity=0)
        self.store_coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='Store Coupon',
            coupon_detail='Free item',
            start_date=timezone.now() - timedelta(hours=1),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='store',
        )

    def test_get_store_coupons_returns_list(self):
        """GET api/store-coupons/ returns 200 with a list payload."""
        response = self.client.get('/api/store-coupons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIsInstance(data, list)

    def test_get_store_coupons_includes_active_coupon(self):
        """GET api/store-coupons/ includes the store coupon just created."""
        response = self.client.get('/api/store-coupons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in response.json()]
        self.assertIn(self.store_coupon.id, ids)

    def test_get_store_coupons_anonymous_ok(self):
        """GET api/store-coupons/ is accessible without authentication."""
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/store-coupons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class GetExclusiveCouponsTests(TestCase):
    """Integration tests for GET api/exclusive-coupons/ (authenticated user's own coupons)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='holder2@test.com',
            email='holder2@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=self.user, verified=True)

        self.other_user = User.objects.create_user(
            username='other2@test.com',
            email='other2@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=self.other_user, verified=True)

        self.store = Store.objects.create(
            owner=self.user,
            name='Excl Store',
            lat=25.0,
            lng=121.0,
            address='789 Test Blvd',
        )
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Excl Template',
            coupon_detail='detail',
            total_quantity=5,
            remaining_quantity=5,
            start_date=timezone.now() - timedelta(hours=1),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        self.coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='My Exclusive',
            coupon_detail='detail',
            start_date=timezone.now() - timedelta(hours=1),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
            original_owner=self.user,
            current_holder=self.user,
        )

    def test_get_exclusive_coupons_for_owner(self):
        """GET api/exclusive-coupons/ returns only the authenticated user's coupons."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/exclusive-coupons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIsInstance(data, list)
        ids = [item['id'] for item in data]
        self.assertIn(self.coupon.id, ids)

    def test_get_exclusive_coupons_excludes_others(self):
        """GET api/exclusive-coupons/ does not expose coupons held by other users."""
        self.client.force_authenticate(user=self.other_user)
        response = self.client.get('/api/exclusive-coupons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in response.json()]
        self.assertNotIn(self.coupon.id, ids)

    def test_get_exclusive_coupons_requires_auth(self):
        """GET api/exclusive-coupons/ without authentication returns 401."""
        response = self.client.get('/api/exclusive-coupons/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
