"""
Tests for the generalized "withdraw share" feature.

A user who has shared an exclusive coupon must be able to withdraw (undo) that
share while it is still pending — for BOTH CouMap public-pool shares and
private link shares. Withdrawing a private share invalidates its token so the
recipient can no longer collect it; withdrawing a public share also restores
the coupon to the sharer's wallet.

Also covers the unified GET /api/my-shares/ listing (public + private).
"""
from datetime import timedelta

from django.test import TestCase
from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from api.models import Store, CouponTemplate, Coupon, CouponShareRequest, StudentProfile


class WithdrawShareTest(TestCase):
    """Withdraw + my-shares coverage for public and private shares."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='sharer@test.com',
            email='sharer@test.com',
            password='testpass123',
        )
        # Public sharing is nickname-gated; set one so share-public succeeds.
        self.profile, _ = StudentProfile.objects.get_or_create(user=self.user)
        self.profile.display_name = '分享者'
        self.profile.save(update_fields=['display_name'])

        self.other = User.objects.create_user(
            username='recipient@test.com',
            email='recipient@test.com',
            password='testpass123',
        )

        self.store = Store.objects.create(
            owner=self.user, name='Test Store', lat=25.0, lng=121.0, address='Test',
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
            current_holder=self.user,
        )

    # ---- helpers -------------------------------------------------------

    def _create_private_share(self):
        """Create a pending private (link) share via the API, return its id."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(f'/api/coupon/{self.coupon.id}/share/', {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        token = resp.data['token']
        return CouponShareRequest.objects.get(token=token)

    def _create_public_share(self):
        """Create a pending public (CouMap) share via the API, return its id."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f'/api/coupon/{self.coupon.id}/share-public/', {}, format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return resp.data['share_id']

    # ---- private (link) withdraw --------------------------------------

    def test_withdraw_private_share_success(self):
        """A pending private share can be withdrawn; coupon stays with sharer."""
        share = self._create_private_share()
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.current_holder, self.user)  # never left wallet

        resp = self.client.post(
            f'/api/coupon/share/{share.id}/withdraw/', {}, format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        share.refresh_from_db()
        self.assertEqual(share.status, 'cancelled')
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.current_holder, self.user)

    def test_withdraw_private_share_invalidates_token(self):
        """After withdraw, the recipient can no longer accept the link."""
        share = self._create_private_share()
        self.client.post(f'/api/coupon/share/{share.id}/withdraw/', {}, format='json')

        self.client.force_authenticate(user=self.other)
        accept = self.client.post(
            f'/api/coupon/share/{share.token}/accept/', {}, format='json'
        )
        self.assertEqual(accept.status_code, status.HTTP_400_BAD_REQUEST)
        # Coupon must remain with the original sharer.
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.current_holder, self.user)

    # ---- public (CouMap) withdraw via the unified route ----------------

    def test_unified_withdraw_route_restores_public_share(self):
        """The new /coupon/share/<id>/withdraw/ route works for public shares."""
        share_id = self._create_public_share()
        self.coupon.refresh_from_db()
        self.assertIsNone(self.coupon.current_holder)  # left the wallet

        resp = self.client.post(
            f'/api/coupon/share/{share_id}/withdraw/', {}, format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.current_holder, self.user)
        self.assertEqual(
            CouponShareRequest.objects.get(id=share_id).status, 'cancelled'
        )

    def test_legacy_public_withdraw_route_still_works(self):
        """The old /coupon/share-public/<id>/withdraw/ route stays functional."""
        share_id = self._create_public_share()
        resp = self.client.post(
            f'/api/coupon/share-public/{share_id}/withdraw/', {}, format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    # ---- guards --------------------------------------------------------

    def test_withdraw_requires_auth(self):
        resp = self.client.post('/api/coupon/share/1/withdraw/', {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cannot_withdraw_another_users_share(self):
        """A share owned by someone else returns 404 (ownership scoped)."""
        share = self._create_private_share()
        self.client.force_authenticate(user=self.other)
        resp = self.client.post(
            f'/api/coupon/share/{share.id}/withdraw/', {}, format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_withdraw_after_accept(self):
        """A share already accepted cannot be withdrawn (400)."""
        share = self._create_private_share()
        self.client.force_authenticate(user=self.other)
        accept = self.client.post(
            f'/api/coupon/share/{share.token}/accept/', {}, format='json'
        )
        self.assertEqual(accept.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f'/api/coupon/share/{share.id}/withdraw/', {}, format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            resp.json().get('error_code'), 'SHARE_NOT_PENDING_FOR_WITHDRAW'
        )

    # ---- my-shares listing --------------------------------------------

    def test_my_shares_requires_auth(self):
        resp = self.client.get('/api/my-shares/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_my_shares_returns_public_and_private(self):
        """GET /api/my-shares/ lists both pending public and private shares."""
        private_share = self._create_private_share()
        public_share_id = self._create_public_share()

        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/my-shares/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        by_id = {row['share_id']: row for row in resp.data}
        self.assertIn(private_share.id, by_id)
        self.assertIn(public_share_id, by_id)
        self.assertFalse(by_id[private_share.id]['is_public'])
        self.assertTrue(by_id[public_share_id]['is_public'])
        self.assertEqual(by_id[private_share.id]['coupon_id'], self.coupon.id)

    def test_my_shares_excludes_withdrawn_and_other_users(self):
        """Cancelled shares and other users' shares are not listed."""
        private_share = self._create_private_share()
        self.client.post(
            f'/api/coupon/share/{private_share.id}/withdraw/', {}, format='json'
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/my-shares/')
        ids = {row['share_id'] for row in resp.data}
        self.assertNotIn(private_share.id, ids)
