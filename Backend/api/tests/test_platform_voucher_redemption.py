"""
T009, T010 [US1]: Contract and unit tests for platform voucher redemption and
validate_unified_redemption_code with available_platform_vouchers.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from api.models import Store, PlatformVoucher, PlatformVoucherRedemption
from api.utils import generate_platform_voucher_redeem_code


class PlatformVoucherRedemptionTest(TestCase):
    """T009: Redemption request/response and business rules."""

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
        self.store_participating = Store.objects.create(
            owner=self.user,
            name="Participating Store",
            address="Addr",
            unified_redeem_code="111111",
            accepts_platform_vouchers=True,
        )
        self.store_not_participating = Store.objects.create(
            owner=self.user,
            name="Non Participating",
            address="Addr2",
            unified_redeem_code="222222",
            accepts_platform_vouchers=False,
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

    def test_redeem_success_returns_200(self):
        """Holder redeems with valid store code; response 200."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/platform-voucher/{self.voucher.id}/redeem/",
            {"redeem_code": "111111"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("message", resp.data)
        self.assertTrue(PlatformVoucherRedemption.objects.filter(voucher=self.voucher).exists())

    def test_redeem_second_time_rejected(self):
        """Second redemption for same voucher is rejected (at most one per voucher)."""
        self.client.force_authenticate(user=self.user)
        PlatformVoucherRedemption.objects.create(
            voucher=self.voucher,
            user=self.user,
            store=self.store_participating,
            amount_used=self.voucher.face_value,
        )
        resp = self.client.post(
            f"/api/platform-voucher/{self.voucher.id}/redeem/",
            {"redeem_code": "111111"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(PlatformVoucherRedemption.objects.filter(voucher=self.voucher).count(), 1)

    def test_redeem_not_holder_403(self):
        """Not current holder gets 403."""
        self.client.force_authenticate(user=self.other)
        resp = self.client.post(
            f"/api/platform-voucher/{self.voucher.id}/redeem/",
            {"redeem_code": "111111"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_redeem_store_not_participating_400(self):
        """Store without accepts_platform_vouchers returns 400."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/platform-voucher/{self.voucher.id}/redeem/",
            {"redeem_code": "222222"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_redeem_invalid_code_400(self):
        """Invalid or non-existent store code returns 400."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/platform-voucher/{self.voucher.id}/redeem/",
            {"redeem_code": "999999"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_redeem_expired_voucher_404(self):
        """Expired voucher returns 404."""
        self.voucher.expiry_date = timezone.now() - timedelta(days=1)
        self.voucher.save()
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/platform-voucher/{self.voucher.id}/redeem/",
            {"redeem_code": "111111"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_redeem_voucher_not_found_404(self):
        """Non-existent voucher_id returns 404."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/platform-voucher/99999/redeem/",
            {"redeem_code": "111111"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class ValidateUnifiedRedemptionPlatformVouchersTest(TestCase):
    """T010: validate_unified_redemption_code returns available_platform_vouchers when store participates."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="consumer@test.com",
            email="consumer@test.com",
            password="testpass123",
        )
        self.store = Store.objects.create(
            owner=self.user,
            name="Store",
            address="Addr",
            unified_redeem_code="123456",
            accepts_platform_vouchers=True,
        )
        now = timezone.now()
        self.voucher = PlatformVoucher.objects.create(
            face_value=50,
            currency_code="TWD",
            start_date=now - timedelta(days=1),
            expiry_date=now + timedelta(days=7),
            current_holder=self.user,
            original_owner=self.user,
            redeem_code=generate_platform_voucher_redeem_code(),
            batch_name="Campaign",
            acquisition_method="platform_issue",
        )

    def test_validate_returns_available_platform_vouchers_when_store_participates(self):
        """GET unified-redemption/<code>/ includes available_platform_vouchers when store accepts."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/unified-redemption/123456/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("available_platform_vouchers", resp.data)
        pv_list = resp.data["available_platform_vouchers"]
        self.assertIsInstance(pv_list, list)
        self.assertEqual(len(pv_list), 1)
        item = pv_list[0]
        self.assertIn("id", item)
        self.assertIn("face_value", item)
        self.assertIn("redeem_code", item)
        self.assertIn("expiry_date", item)
        self.assertIn("batch_name", item)
        self.assertEqual(item["id"], self.voucher.id)
        self.assertEqual(item["face_value"], "50.00")

    def test_validate_platform_vouchers_empty_when_store_does_not_participate(self):
        """When store has accepts_platform_vouchers=False, key may be omitted or empty."""
        self.store.accepts_platform_vouchers = False
        self.store.save()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/unified-redemption/123456/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # We always include the key; it is empty when store doesn't participate
        self.assertIn("available_platform_vouchers", resp.data)
        self.assertEqual(resp.data["available_platform_vouchers"], [])
