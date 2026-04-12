"""Tests for POST /api/web/v1/points/lookup/ (phone normalization and totals)."""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from api.models import Store, CouponTemplate, WebRedemption, StudentProfile, CouponRedemption, Coupon

User = get_user_model()


class WebPointsLookupTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="ptuser", email="pt@example.com", password="x")
        self.profile = StudentProfile.objects.create(
            user=self.user,
            phone_number="0912345678",
        )
        self.store = Store.objects.create(name="S", owner=self.user)
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name="T",
            coupon_detail="d",
            start_date="2025-01-01T00:00:00Z",
            expiry_date="2030-12-31T23:59:59Z",
            remaining_quantity=10,
            is_active=True,
        )
        WebRedemption.objects.create(
            template=self.template,
            session_token="sess-1",
            phone_number="0912345678",
        )
        coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name="c",
            coupon_detail="d",
            start_date="2025-01-01T00:00:00Z",
            expiry_date="2030-12-31T23:59:59Z",
            coupon_type="exclusive",
            current_holder=self.user,
        )
        CouponRedemption.objects.create(
            coupon=coupon,
            user=self.user,
            savings_amount=0,
            coupon_type="exclusive",
        )

    def test_invalid_phone_returns_400(self):
        resp = self.client.post(
            "/api/web/v1/points/lookup/",
            {"phone_number": "123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("error", resp.data)

    def test_spaced_phone_normalizes_and_counts(self):
        """Spaces stripped by validate_phone_number; totals match DB."""
        resp = self.client.post(
            "/api/web/v1/points/lookup/",
            {"phone_number": "0912 345 678"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["phone_number"], "0912345678")
        # 1 WebRedemption + 1 CouponRedemption for this phone
        self.assertEqual(resp.data["total_points"], 2)

    def test_session_token_binds_unlinked_web_redemption(self):
        """Points lookup with session_token updates WebRedemption rows with null phone."""
        wr = WebRedemption.objects.create(
            template=self.template,
            session_token="bind-session-xyz",
            phone_number=None,
        )
        resp = self.client.post(
            "/api/web/v1/points/lookup/",
            {
                "phone_number": "0912345678",
                "session_token": "bind-session-xyz",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        wr.refresh_from_db()
        self.assertEqual(wr.phone_number, "0912345678")

    def test_points_lookup_does_not_flip_progress_applied(self):
        """Web self-redemption does not sync to sharing lights; progress_applied stays false."""
        WebRedemption.objects.create(
            template=self.template,
            session_token="sess-pending",
            phone_number="0912345678",
            progress_applied=False,
        )
        pending_before = WebRedemption.objects.filter(
            phone_number="0912345678", progress_applied=False
        ).count()
        self.assertGreaterEqual(pending_before, 1)

        resp = self.client.post(
            "/api/web/v1/points/lookup/",
            {"phone_number": "0912345678"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            WebRedemption.objects.filter(
                phone_number="0912345678", progress_applied=False
            ).count(),
            pending_before,
        )
