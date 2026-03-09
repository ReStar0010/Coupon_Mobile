"""
Tests for load test reset API: only clears redemptions and returns {ok: true}; no config.
"""
import os
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from api.models import CouponRedemption


class LoadTestResetViewTest(TestCase):
    """POST /api/load-test/reset/ returns 200 and {ok: true}, no config in response."""

    def setUp(self):
        self.secret = "test-load-test-secret"
        os.environ["LOAD_TEST_SECRET"] = self.secret
        self.url = "/api/load-test/reset/"

    def tearDown(self):
        os.environ.pop("LOAD_TEST_SECRET", None)

    def test_reset_returns_200_and_ok_true(self):
        response = self.client.post(
            self.url,
            data=b"{}",
            content_type="application/json",
            HTTP_X_LOAD_TEST_SECRET=self.secret,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("ok"), True)
        self.assertNotIn("config", data)

    def test_reset_requires_secret(self):
        response = self.client.post(
            self.url,
            data=b"{}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_reset_clears_redemptions(self):
        # Create a redemption so we have something to clear (minimal: need Coupon + User)
        from django.contrib.auth.models import User
        from api.models import Store, Coupon

        now = timezone.now()
        expiry = now + timedelta(days=1)
        user = User.objects.create_user(username="u1", email="u1@test.com", password="x")
        store = Store.objects.create(
            owner=user,
            name="S1",
            unified_redeem_code="CODE1",
            lat=25.0,
            lng=121.5,
            address="A1",
            business_hours="09-18",
            store_type="restaurant",
        )
        coupon = Coupon.objects.create(
            store=store,
            coupon_name="C1",
            coupon_detail="D1",
            coupon_type="store",
            start_date=now,
            expiry_date=expiry,
        )
        CouponRedemption.objects.create(coupon=coupon, user=user, coupon_type="store")
        self.assertEqual(CouponRedemption.objects.count(), 1)

        response = self.client.post(
            self.url,
            data=b"{}",
            content_type="application/json",
            HTTP_X_LOAD_TEST_SECRET=self.secret,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})
        self.assertEqual(CouponRedemption.objects.count(), 0)
