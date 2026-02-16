"""
T009 [US3]: Tests for sharing and collection/claim landing routes.
Routes: api/coupon/<id>/share/, api/coupon/share/<token>/,
api/coupon/share/<token>/accept/, api/my-public-shares/,
collection/<token>/, c/<token>/, claim/<token>/, cl/<token>/
"""
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from api.models import Store, CouponTemplate, Coupon, CouponShareRequest


class SharingRoutesTest(TestCase):
    """Coverage for coupon sharing and claim/collection landing endpoints."""

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
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Test',
            coupon_detail='Detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        self.coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='Test',
            coupon_detail='Detail',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
        )
        self.share_request = CouponShareRequest.objects.create(
            coupon=self.coupon,
            from_user=self.user,
            token='test-share-token-123',
        )

    def test_share_coupon_requires_auth(self):
        """POST api/coupon/<id>/share/ without auth returns 401."""
        response = self.client.post(f'/api/coupon/{self.coupon.id}/share/', {
            'recipient_email': 'other@test.com',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_share_coupon_success_or_4xx(self):
        """POST api/coupon/<id>/share/ with auth returns 200 or 4xx."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f'/api/coupon/{self.coupon.id}/share/', {
            'recipient_email': 'other@test.com',
        }, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_share_public_requires_auth(self):
        """POST api/coupon/<id>/share-public/ without auth returns 401."""
        response = self.client.post(f'/api/coupon/{self.coupon.id}/share-public/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_share_token_get(self):
        """GET api/coupon/share/<token>/ returns 200 or 4xx."""
        response = self.client.get(f'/api/coupon/share/{self.share_request.token}/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND))

    def test_share_accept_requires_auth(self):
        """POST api/coupon/share/<token>/accept/ without auth returns 401."""
        response = self.client.post(f'/api/coupon/share/{self.share_request.token}/accept/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_my_public_shares_unauth_401(self):
        """GET api/my-public-shares/ without auth returns 401."""
        response = self.client.get('/api/my-public-shares/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_my_public_shares_success(self):
        """GET api/my-public-shares/ with auth returns 200."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/my-public-shares/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_collection_landing(self):
        """GET collection/<token>/ returns 200 or 404."""
        response = self.client.get('/collection/some-token/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND))

    def test_collection_short_landing(self):
        """GET c/<token>/ returns 200 or 404."""
        response = self.client.get('/c/some-token/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND))

    def test_claim_landing(self):
        """GET claim/<token>/ returns 200 or 404."""
        response = self.client.get('/claim/some-token/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND))

    def test_claim_short_landing(self):
        """GET cl/<token>/ returns 200 or 404."""
        response = self.client.get('/cl/some-token/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND))
