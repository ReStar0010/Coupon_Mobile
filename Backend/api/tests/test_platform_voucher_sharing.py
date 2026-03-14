"""
T019 [US3]: Contract and unit tests for platform voucher share flows.
Covers share create, get_share by token, accept_share (race-safe), share_public, my_public_shares, self-claim blocked for public.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from api.models import PlatformVoucher, PlatformVoucherShareRequest
from api.utils import generate_platform_voucher_redeem_code


class PlatformVoucherSharingTest(TestCase):
    """Share create, get by token, accept (race-safe), share-public, my_public_shares."""

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

    def test_share_create_returns_token_and_links(self):
        """POST share creates share request and returns token, share_link, share_link_web."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(f"/api/platform-voucher/{self.voucher.id}/share/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("token", resp.data)
        self.assertIn("share_link", resp.data)
        self.assertIn("share_link_web", resp.data)
        self.assertTrue(PlatformVoucherShareRequest.objects.filter(voucher=self.voucher, is_public=False).exists())

    def test_get_share_by_token_returns_info(self):
        """GET share/<token>/ returns voucher_id, face_value, from_user_email, status, is_public."""
        share = PlatformVoucherShareRequest.objects.create(
            voucher=self.voucher,
            from_user=self.user,
            token="testtoken123",
            status="pending",
            is_public=False,
        )
        resp = self.client.get("/api/platform-voucher/share/testtoken123/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["voucher_id"], self.voucher.id)
        self.assertEqual(resp.data["from_user_email"], self.user.email)
        self.assertEqual(resp.data["status"], "pending")
        self.assertFalse(resp.data["is_public"])

    def test_accept_share_transfers_voucher(self):
        """POST accept transfers voucher to acceptor."""
        share = PlatformVoucherShareRequest.objects.create(
            voucher=self.voucher,
            from_user=self.user,
            token="accepttoken",
            status="pending",
            is_public=False,
        )
        self.client.force_authenticate(user=self.other)
        resp = self.client.post("/api/platform-voucher/share/accepttoken/accept/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.voucher.refresh_from_db()
        self.assertEqual(self.voucher.current_holder_id, self.other.id)
        share.refresh_from_db()
        self.assertEqual(share.status, "accepted")
        self.assertEqual(share.to_user_id, self.other.id)

    def test_accept_share_already_accepted_400(self):
        """Accepting an already accepted share returns 400."""
        share = PlatformVoucherShareRequest.objects.create(
            voucher=self.voucher,
            from_user=self.user,
            to_user=self.other,
            token="donetoken",
            status="accepted",
            is_public=False,
        )
        self.client.force_authenticate(user=self.other)
        resp = self.client.post("/api/platform-voucher/share/donetoken/accept/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_share_public_creates_public_share_and_clears_holder(self):
        """POST share-public creates is_public share and sets voucher.current_holder to null."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(f"/api/platform-voucher/{self.voucher.id}/share-public/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.voucher.refresh_from_db()
        self.assertIsNone(self.voucher.current_holder_id)
        self.assertTrue(
            PlatformVoucherShareRequest.objects.filter(voucher=self.voucher, is_public=True, status="pending").exists()
        )

    def test_my_public_voucher_shares_returns_list(self):
        """GET my-public-voucher-shares returns shares where from_user=request.user and is_public=True."""
        PlatformVoucherShareRequest.objects.create(
            voucher=self.voucher,
            from_user=self.user,
            token="mypublic",
            status="pending",
            is_public=True,
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/my-public-voucher-shares/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsInstance(resp.data, list)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["voucher_id"], self.voucher.id)
        self.assertEqual(resp.data[0]["status"], "pending")

    def test_public_share_self_claim_blocked_400(self):
        """Accepting own public share returns 400 (no self-claim)."""
        self.voucher.current_holder = None
        self.voucher.save()
        share = PlatformVoucherShareRequest.objects.create(
            voucher=self.voucher,
            from_user=self.user,
            token="selfclaim",
            status="pending",
            is_public=True,
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/platform-voucher/share/selfclaim/accept/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get("error_code"), "SELF_CLAIM_NOT_ALLOWED")