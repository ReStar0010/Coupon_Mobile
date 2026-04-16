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

    def test_share_coupon_web_link_requests_external_browser(self):
        """share_link_web includes open_ext=1 so the landing can hand off to Safari/Chrome."""
        self.coupon.current_holder = self.user
        self.coupon.save(update_fields=['current_holder'])
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f'/api/coupon/{self.coupon.id}/share/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        web = response.data.get('share_link_web') or ''
        self.assertIn('open_ext=1', web)
        self.assertIn('/collection/', web)

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

    def test_withdraw_public_share_unauth_401(self):
        """POST api/coupon/share-public/<id>/withdraw/ without auth returns 401."""
        response = self.client.post('/api/coupon/share-public/1/withdraw/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_withdraw_public_share_success(self):
        """Withdraw pending public share restores coupon to user."""
        self.coupon.current_holder = self.user
        self.coupon.save()
        self.client.force_authenticate(user=self.user)
        share_resp = self.client.post(
            f'/api/coupon/{self.coupon.id}/share-public/', {}, format='json'
        )
        self.assertEqual(share_resp.status_code, status.HTTP_200_OK)
        share_id = share_resp.data.get('share_id')
        self.assertIsNotNone(share_id)
        self.coupon.refresh_from_db()
        self.assertIsNone(self.coupon.current_holder)

        withdraw_resp = self.client.post(
            f'/api/coupon/share-public/{share_id}/withdraw/', {}, format='json'
        )
        self.assertEqual(withdraw_resp.status_code, status.HTTP_200_OK)
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.current_holder, self.user)
        share = CouponShareRequest.objects.get(id=share_id)
        self.assertEqual(share.status, 'cancelled')

    def test_collection_landing(self):
        """GET collection/<token>/ returns 200 or 404."""
        response = self.client.get('/collection/some-token/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND))

    def test_collection_landing_has_smart_open_app_markup(self):
        """Fallback page should escape in-app browsers and open app / store via script."""
        response = self.client.get(f'/collection/{self.share_request.token}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.content.decode('utf-8')
        self.assertIn('x-safari-https://', body)
        self.assertIn('googlechrome://navigate', body)
        self.assertIn('visibilitychange', body)
        self.assertIn('scheme=coupro', body)

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


class ConsumerFlowFlagScopeTest(TestCase):
    """
    WEB_CONSUMER_FLOW_ENABLED must ONLY affect the table/desk QR (claim-fixed)
    route. Shared coupon links (/collection/<token>/) and personal claim
    fallbacks (/claim/<token>/, /cl/<token>/) must keep their mobile-first
    Universal Link landing even when the flag is on.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='flagtest@test.com',
            email='flagtest@test.com',
            password='testpass123',
        )
        self.store = Store.objects.create(
            owner=self.user,
            name='Flag Store',
            lat=25.0,
            lng=121.0,
            address='Flag',
        )
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Flag',
            coupon_detail='Flag Detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        self.coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='Flag',
            coupon_detail='Flag Detail',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
        )
        self.share_request = CouponShareRequest.objects.create(
            coupon=self.coupon,
            from_user=self.user,
            token='flag-share-token-xyz',
        )

    def test_collection_landing_stays_mobile_when_flag_enabled(self):
        """Shared-link /collection/<token>/ must render mobile landing (200),
        NOT redirect to the web flow, even with WEB_CONSUMER_FLOW_ENABLED=True."""
        with self.settings(WEB_CONSUMER_FLOW_ENABLED=True, FRONTEND_URL='https://app.coupro.pro'):
            response = self.client.get(f'/collection/{self.share_request.token}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        location = response.get('Location', '') or ''
        self.assertNotIn('/w/share/', location)

    def test_claim_landing_stays_mobile_when_flag_enabled(self):
        """Personal claim fallback /claim/<token>/ must render mobile landing
        when WEB_CONSUMER_FLOW_ENABLED=True (shared-link flow, not table QR)."""
        with self.settings(WEB_CONSUMER_FLOW_ENABLED=True, FRONTEND_URL='https://app.coupro.pro'):
            response = self.client.get('/claim/any-token/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        location = response.get('Location', '') or ''
        self.assertNotIn('/w/claim/', location)

    def test_claim_fixed_landing_redirects_to_web_when_flag_enabled(self):
        """Table/desk QR /claim-fixed/<token>/ MUST still redirect to web
        consumer flow when the flag is enabled."""
        with self.settings(WEB_CONSUMER_FLOW_ENABLED=True, FRONTEND_URL='https://app.coupro.pro'):
            response = self.client.get('/claim-fixed/table-token-1/')
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn('/w/claim-fixed/table-token-1/', response['Location'])

    def test_claim_fixed_landing_renders_when_flag_disabled(self):
        """Table/desk QR with flag disabled renders the mobile landing page."""
        with self.settings(WEB_CONSUMER_FLOW_ENABLED=False):
            response = self.client.get('/claim-fixed/table-token-2/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
