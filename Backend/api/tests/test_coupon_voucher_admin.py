"""
Tests for coupon and platform voucher admin: filters, list_display, and actions.
"""
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from django.utils import timezone

from api.admin import (
    CouponAdmin,
    CouponExpiredFilter,
    CouponRedeemedFilter,
    PlatformVoucherAdmin,
    PlatformVoucherExpiredFilter,
    PlatformVoucherRedeemedFilter,
    StudentProfileAdmin,
    SharingProgressFilter,
)
from api.models import (
    Coupon,
    CouponRedemption,
    CouponShareRequest,
    PlatformVoucher,
    PlatformVoucherRedemption,
    Store,
    StudentProfile,
)

User = get_user_model()


class CouponAdminFilterTest(TestCase):
    def setUp(self):
        self.site = AdminSite()
        self.request = RequestFactory().get("/admin/api/coupon/")
        self.request.user = User.objects.create_superuser(
            username="admin", email="admin@test.com", password="pass"
        )
        self.model_admin = CouponAdmin(Coupon, self.site)
        owner = User.objects.create_user(username="owner", email="owner@test.com", password="pass")
        self.store = Store.objects.create(
            name="Test Store",
            owner=owner,
            store_type="restaurant",
            address="addr",
        )

    def test_expired_filter_yes(self):
        qs = Coupon.objects.all()
        f = CouponExpiredFilter(self.request, {"expired": "yes"}, Coupon, self.model_admin)
        filtered = f.queryset(self.request, qs)
        # 用「是否真的加上過期日條件」來驗證（不依賴 Django lookup 字串）
        q = str(filtered.query)
        self.assertIn("expiry_date", q)
        self.assertTrue((" <=" in q) or (" < " in q), q)

    def test_expired_filter_no(self):
        qs = Coupon.objects.all()
        f = CouponExpiredFilter(self.request, {"expired": "no"}, Coupon, self.model_admin)
        filtered = f.queryset(self.request, qs)
        q = str(filtered.query)
        self.assertIn("expiry_date", q)
        self.assertTrue((" >=" in q) or (" > " in q), q)

    def test_redeemed_filter_uses_exists(self):
        qs = Coupon.objects.all()
        f = CouponRedeemedFilter(self.request, {"redeemed": "yes"}, Coupon, self.model_admin)
        filtered = f.queryset(self.request, qs)
        self.assertIn("EXISTS", str(filtered.query))


class PlatformVoucherAdminFilterTest(TestCase):
    def setUp(self):
        self.site = AdminSite()
        self.request = RequestFactory().get("/admin/api/platformvoucher/")
        self.request.user = User.objects.create_superuser(
            username="admin2", email="admin2@test.com", password="pass"
        )
        self.model_admin = PlatformVoucherAdmin(PlatformVoucher, self.site)

    def test_expired_filter_yes(self):
        qs = PlatformVoucher.objects.all()
        f = PlatformVoucherExpiredFilter(
            self.request, {"expired": "yes"}, PlatformVoucher, self.model_admin
        )
        filtered = f.queryset(self.request, qs)
        q = str(filtered.query)
        self.assertIn("expiry_date", q)
        self.assertTrue((" <=" in q) or (" < " in q), q)

    def test_redeemed_filter_no(self):
        qs = PlatformVoucher.objects.all()
        f = PlatformVoucherRedeemedFilter(
            self.request, {"redeemed": "no"}, PlatformVoucher, self.model_admin
        )
        filtered = f.queryset(self.request, qs)
        # no 也會用 EXISTS 來做「排除已兌換」的判斷
        self.assertIn("EXISTS", str(filtered.query))


class StudentProfileAdminFilterTest(TestCase):
    def setUp(self):
        self.site = AdminSite()
        self.request = RequestFactory().get("/admin/api/studentprofile/")
        self.request.user = User.objects.create_superuser(
            username="admin3", email="admin3@test.com", password="pass"
        )
        self.model_admin = StudentProfileAdmin(StudentProfile, self.site)

    def test_sharing_progress_filter(self):
        qs = StudentProfile.objects.all()
        f = SharingProgressFilter(
            self.request, {"sharing_progress": "1"}, StudentProfile, self.model_admin
        )
        filtered = f.queryset(self.request, qs)
        self.assertIn("sharing_progress_count", str(filtered.query))
