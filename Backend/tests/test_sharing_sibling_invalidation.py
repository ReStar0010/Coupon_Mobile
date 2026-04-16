"""
Regression tests for the sibling private-share bug:

When a coupon owner creates TWO private share requests (to A and B) for the
same coupon, only the first recipient to accept should be able to claim the
coupon. The remaining sibling share request(s) must be invalidated, and
subsequent accept attempts must not transfer the coupon away from the first
recipient.

Covers:
- Backend/api/views/sharing_views.py::accept_share_request
- Backend/api/views/web_v1/shares.py::share_detail
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Coupon, CouponShareRequest, CouponTemplate, Store


def _build_coupon_fixture(sharer: User) -> tuple[Store, CouponTemplate, Coupon]:
    store = Store.objects.create(
        owner=sharer,
        name='Sibling Test Store',
        lat=25.0,
        lng=121.0,
        address='Test',
    )
    template = CouponTemplate.objects.create(
        store=store,
        coupon_name='Sibling Test',
        coupon_detail='Detail',
        total_quantity=10,
        remaining_quantity=10,
        start_date=timezone.now(),
        expiry_date=timezone.now() + timedelta(days=30),
        is_active=True,
    )
    coupon = Coupon.objects.create(
        store=store,
        template=template,
        coupon_name='Sibling Test',
        coupon_detail='Detail',
        start_date=timezone.now(),
        expiry_date=timezone.now() + timedelta(days=30),
        coupon_type='exclusive',
        acquisition_method='consolidate',
        current_holder=sharer,
    )
    return store, template, coupon


class PrivateShareSiblingInvalidationTest(TestCase):
    """Two private share requests on the same coupon must not both be claimable."""

    def setUp(self) -> None:
        self.client = APIClient()
        self.sharer = User.objects.create_user(
            username='sharer@test.com', email='sharer@test.com', password='pw',
        )
        self.user_a = User.objects.create_user(
            username='a@test.com', email='a@test.com', password='pw',
        )
        self.user_b = User.objects.create_user(
            username='b@test.com', email='b@test.com', password='pw',
        )
        _, _, self.coupon = _build_coupon_fixture(self.sharer)
        self.share_to_a = CouponShareRequest.objects.create(
            coupon=self.coupon,
            from_user=self.sharer,
            to_user=self.user_a,
            token='token-to-a',
        )
        self.share_to_b = CouponShareRequest.objects.create(
            coupon=self.coupon,
            from_user=self.sharer,
            to_user=self.user_b,
            token='token-to-b',
        )

    def test_first_recipient_claims_successfully(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(f'/api/coupon/share/{self.share_to_a.token}/accept/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.current_holder, self.user_a)
        self.share_to_a.refresh_from_db()
        self.assertEqual(self.share_to_a.status, 'accepted')

    def test_first_accept_cancels_sibling_pending_share(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        self.client.post(f'/api/coupon/share/{self.share_to_a.token}/accept/')
        self.share_to_b.refresh_from_db()
        self.assertEqual(self.share_to_b.status, 'cancelled')
        self.assertIsNotNone(self.share_to_b.responded_at)

    def test_second_recipient_cannot_claim_after_first(self) -> None:
        """Bug regression: once A claims, B's click must NOT re-assign the holder."""
        self.client.force_authenticate(user=self.user_a)
        self.client.post(f'/api/coupon/share/{self.share_to_a.token}/accept/')

        self.client.force_authenticate(user=self.user_b)
        response = self.client.post(f'/api/coupon/share/{self.share_to_b.token}/accept/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.current_holder, self.user_a)

    def test_second_recipient_blocked_even_if_sibling_row_still_pending(self) -> None:
        """
        Defensive path: simulate a race where B's share_request row is still
        marked 'pending' when B attempts to accept, but the coupon has already
        been transferred. The holder check must still block the claim.
        """
        self.coupon.current_holder = self.user_a
        self.coupon.save()
        self.assertEqual(self.share_to_b.status, 'pending')

        self.client.force_authenticate(user=self.user_b)
        response = self.client.post(f'/api/coupon/share/{self.share_to_b.token}/accept/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.current_holder, self.user_a)

    def test_public_share_unaffected_by_private_sibling_cancellation(self) -> None:
        """A pending public share for the same coupon must NOT be cancelled
        by a private accept — public shares have their own lifecycle."""
        public_share = CouponShareRequest.objects.create(
            coupon=self.coupon,
            from_user=self.sharer,
            token='public-token',
            is_public=True,
        )
        self.client.force_authenticate(user=self.user_a)
        self.client.post(f'/api/coupon/share/{self.share_to_a.token}/accept/')

        public_share.refresh_from_db()
        self.assertEqual(public_share.status, 'pending')


class WebShareDetailStatusTest(TestCase):
    """GET /api/web/v1/shares/<token>/ must expose share status so the web
    landing page can render an 'already claimed' state."""

    def setUp(self) -> None:
        self.client = APIClient()
        self.sharer = User.objects.create_user(
            username='web-s@test.com', email='web-s@test.com', password='pw',
        )
        _, _, self.coupon = _build_coupon_fixture(self.sharer)
        self.share = CouponShareRequest.objects.create(
            coupon=self.coupon,
            from_user=self.sharer,
            token='web-share-token',
        )

    def test_pending_share_exposes_status(self) -> None:
        response = self.client.get(f'/api/web/v1/shares/{self.share.token}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'pending')
        self.assertFalse(response.data['is_public'])

    def test_cancelled_share_exposes_status(self) -> None:
        self.share.status = 'cancelled'
        self.share.responded_at = timezone.now()
        self.share.save()
        response = self.client.get(f'/api/web/v1/shares/{self.share.token}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'cancelled')

    def test_accepted_share_exposes_status(self) -> None:
        self.share.status = 'accepted'
        self.share.responded_at = timezone.now()
        self.share.save()
        response = self.client.get(f'/api/web/v1/shares/{self.share.token}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'accepted')
