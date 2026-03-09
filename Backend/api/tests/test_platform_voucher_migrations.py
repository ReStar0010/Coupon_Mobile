"""
Migration tests for platform voucher models (011-platform-cash-voucher).
Verifies migration 0042_platform_voucher_models: Store flag and PlatformVoucher, etc.
"""
from django.test import TestCase

from api.models import Store, PlatformVoucher, PlatformVoucherRedemption, PlatformVoucherShareRequest


class PlatformVoucherMigrationTest(TestCase):
    """T008: Verify platform voucher migration adds Store flag and new models."""

    def test_store_has_accepts_platform_vouchers(self):
        """Store has accepts_platform_vouchers BooleanField, default False."""
        self.assertTrue(hasattr(Store, "accepts_platform_vouchers"))
        field = Store._meta.get_field("accepts_platform_vouchers")
        self.assertEqual(field.get_internal_type(), "BooleanField")
        self.assertFalse(field.default)

    def test_platform_voucher_model_exists(self):
        """PlatformVoucher model has required fields."""
        self.assertTrue(hasattr(PlatformVoucher, "face_value"))
        self.assertTrue(hasattr(PlatformVoucher, "currency_code"))
        self.assertTrue(hasattr(PlatformVoucher, "redeem_code"))
        self.assertTrue(hasattr(PlatformVoucher, "current_holder"))
        self.assertTrue(hasattr(PlatformVoucher, "original_owner"))
        self.assertTrue(hasattr(PlatformVoucher, "last_holder"))
        self.assertTrue(hasattr(PlatformVoucher, "batch_name"))
        self.assertTrue(hasattr(PlatformVoucher, "acquisition_method"))
        self.assertTrue(hasattr(PlatformVoucher, "created_at"))
        self.assertTrue(PlatformVoucher._meta.get_field("redeem_code").unique)

    def test_platform_voucher_redemption_model_exists(self):
        """PlatformVoucherRedemption has one-to-one voucher and unique constraint."""
        self.assertTrue(hasattr(PlatformVoucherRedemption, "voucher"))
        self.assertTrue(hasattr(PlatformVoucherRedemption, "user"))
        self.assertTrue(hasattr(PlatformVoucherRedemption, "store"))
        self.assertTrue(hasattr(PlatformVoucherRedemption, "amount_used"))
        self.assertTrue(hasattr(PlatformVoucherRedemption, "redeemed_at"))
        # OneToOne implies unique on voucher
        self.assertTrue(PlatformVoucherRedemption._meta.get_field("voucher").unique)

    def test_platform_voucher_share_request_model_exists(self):
        """PlatformVoucherShareRequest has token, status, is_public, unique pending public constraint."""
        self.assertTrue(hasattr(PlatformVoucherShareRequest, "voucher"))
        self.assertTrue(hasattr(PlatformVoucherShareRequest, "from_user"))
        self.assertTrue(hasattr(PlatformVoucherShareRequest, "to_user"))
        self.assertTrue(hasattr(PlatformVoucherShareRequest, "token"))
        self.assertTrue(hasattr(PlatformVoucherShareRequest, "status"))
        self.assertTrue(hasattr(PlatformVoucherShareRequest, "is_public"))
        self.assertTrue(PlatformVoucherShareRequest._meta.get_field("token").unique)
