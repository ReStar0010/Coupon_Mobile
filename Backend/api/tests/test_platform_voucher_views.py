"""
T015 [US2]: Contract and unit tests for platform voucher list and detail.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from api.models import Store, PlatformVoucher, PlatformVoucherRedemption
from api.utils import generate_platform_voucher_redeem_code


class PlatformVoucherListDetailTest(TestCase):
    """List (only current_holder, not expired, not redeemed) and detail (holder vs 403/404)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="holder@test.com",
            email="holder@test.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="other@test.com",
            email="other@test.com",
            password="testpass123",
        )
        now = timezone.now()
        self.voucher = PlatformVoucher.objects.create(
            face_value=100,
            currency_code="TWD",
            start_date=now - timedelta(days=1),
            expiry_date=now + timedelta(days=30),
            current_holder=self.user,
            original_owner=self.user,
            redeem_code=generate_platform_voucher_redeem_code(),
            batch_name="Test",
            acquisition_method="platform_issue",
        )

    def test_list_returns_only_current_holder_vouchers(self):
        """GET platform-vouchers/ returns only vouchers for authenticated user."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/platform-vouchers/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsInstance(resp.data, list)
        self.assertEqual(len(resp.data), 1)
        item = resp.data[0]
        self.assertIn("id", item)
        self.assertIn("face_value", item)
        self.assertIn("currency_code", item)
        self.assertIn("redeem_code", item)
        self.assertIn("expiry_date", item)
        self.assertIn("batch_name", item)
        self.assertEqual(item["id"], self.voucher.id)

    def test_list_excludes_other_holders(self):
        """List for other user does not include voucher held by self.user."""
        self.client.force_authenticate(user=self.other)
        resp = self.client.get("/api/platform-vouchers/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 0)

    def test_list_requires_auth(self):
        """GET platform-vouchers/ returns 401 when not authenticated."""
        resp = self.client.get("/api/platform-vouchers/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_detail_returns_200_for_holder(self):
        """GET platform-vouchers/<id>/ returns detail when user is current_holder."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/platform-vouchers/{self.voucher.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("id", resp.data)
        self.assertIn("face_value", resp.data)
        self.assertIn("is_redeemed", resp.data)
        self.assertIn("current_holder_id", resp.data)
        self.assertEqual(resp.data["id"], self.voucher.id)
        self.assertFalse(resp.data["is_redeemed"])

    def test_detail_returns_403_for_non_holder(self):
        """GET platform-vouchers/<id>/ returns 403 when user is not current_holder."""
        self.client.force_authenticate(user=self.other)
        resp = self.client.get(f"/api/platform-vouchers/{self.voucher.id}/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_detail_returns_404_for_invalid_id(self):
        """GET platform-vouchers/<id>/ returns 404 for non-existent id."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/platform-vouchers/99999/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
