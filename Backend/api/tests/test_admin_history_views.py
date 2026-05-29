"""
Admin history & holdings tests.

Covers three new admin surfaces:
  1. /admin/api/studentprofile/<id>/draw-history/  — every daily-draw attempt
  2. /admin/api/studentprofile/<id>/spin-history/  — every spinner WalletTransaction
  3. /admin/api/studentprofile/<id>/holdings/      — coupons + platform vouchers currently held

Plus the underlying persistence change: draw_coupon must write a
DailyDrawAttempt row on BOTH success and miss branches.
"""
from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import (
    Coupon,
    CouponTemplate,
    DailyDrawAttempt,
    PlatformVoucher,
    Store,
    StudentProfile,
    Wallet,
    WalletTransaction,
)

User = get_user_model()


def _make_user(username: str, *, is_staff: bool = False, is_superuser: bool = False):
    return User.objects.create_user(
        username=username,
        email=f"{username}@test.com",
        password="pass1234",
        is_staff=is_staff,
        is_superuser=is_superuser,
    )


def _make_store(owner) -> Store:
    return Store.objects.create(
        name="Test Store",
        owner=owner,
        store_type="restaurant",
        address="addr",
    )


def _make_template(store, *, probability: float = 1.0, quantity: int = 10) -> CouponTemplate:
    now = timezone.now()
    return CouponTemplate.objects.create(
        store=store,
        coupon_name="Draw Template",
        coupon_detail="50% off",
        total_quantity=quantity,
        remaining_quantity=quantity,
        start_date=now - timezone.timedelta(days=1),
        expiry_date=now + timezone.timedelta(days=7),
        is_active=True,
        draw_probability=probability,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1. draw_coupon view writes DailyDrawAttempt rows (success + miss)
# ─────────────────────────────────────────────────────────────────────────────


class DrawCouponWritesAttemptRow(TestCase):
    """The draw_coupon API endpoint must persist one DailyDrawAttempt per call,
    regardless of whether the user won or lost the probability roll."""

    def setUp(self):
        self.user = _make_user("drawer")
        StudentProfile.objects.create(user=self.user, phone_number="0900000001", verified=True)
        merchant = _make_user("merchant")
        self.store = _make_store(merchant)
        self.template = _make_template(self.store, probability=1.0)
        # The API uses JWT auth, not session. Use APIClient.force_authenticate
        # so DRF's JWTAuthentication picks up request.user.
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_winning_draw_creates_attempt_with_awarded_coupon(self):
        resp = self.api_client.post(
            "/api/coupon/daily-draw/",
            data={"template_id": self.template.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(DailyDrawAttempt.objects.filter(user=self.user).count(), 1)
        attempt = DailyDrawAttempt.objects.get(user=self.user)
        self.assertTrue(attempt.success)
        self.assertEqual(attempt.template_id, self.template.id)
        self.assertIsNotNone(attempt.awarded_coupon_id)
        # Probability snapshot survives even if template later changes.
        self.assertEqual(float(attempt.draw_probability), 1.0)
        self.assertIsNotNone(attempt.attempted_at)

    def test_losing_draw_still_creates_attempt_row(self):
        # Force the random roll to lose by setting probability to 0.
        losing_template = _make_template(self.store, probability=0.0)
        resp = self.api_client.post(
            "/api/coupon/daily-draw/",
            data={"template_id": losing_template.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        attempt = DailyDrawAttempt.objects.get(user=self.user, template=losing_template)
        self.assertFalse(attempt.success)
        self.assertIsNone(attempt.awarded_coupon_id)
        self.assertEqual(float(attempt.draw_probability), 0.0)

    def test_failed_coupon_generation_rolls_back_the_attempt_row(self):
        """If generate_coupon explodes mid-transaction, the attempt row AND
        the cooldown advance (last_draw_time) must both roll back. We never
        want a user's cooldown burned with no outcome to show for it (the
        HIGH issue surfaced in code review)."""
        profile = StudentProfile.objects.get(user=self.user)
        self.assertIsNone(profile.last_draw_time)  # baseline

        with patch.object(CouponTemplate, "generate_coupon", side_effect=RuntimeError("boom")):
            resp = self.api_client.post(
                "/api/coupon/daily-draw/",
                data={"template_id": self.template.id},
                format="json",
            )
        self.assertIn(resp.status_code, (400, 500))
        self.assertEqual(DailyDrawAttempt.objects.filter(user=self.user).count(), 0)

        # Cooldown must NOT have advanced — both writes share the same atomic
        # block so an exception inside it rolls back both.
        profile.refresh_from_db()
        self.assertIsNone(profile.last_draw_time)


# ─────────────────────────────────────────────────────────────────────────────
# 2. /admin/api/studentprofile/<id>/draw-history/
# ─────────────────────────────────────────────────────────────────────────────


class DrawHistoryAdminViewTest(TestCase):
    def setUp(self):
        self.admin = _make_user("admin1", is_staff=True, is_superuser=True)
        self.user_a = _make_user("ua")
        self.user_b = _make_user("ub")
        self.profile_a = StudentProfile.objects.create(user=self.user_a, phone_number="0900000010")
        self.profile_b = StudentProfile.objects.create(user=self.user_b, phone_number="0900000011")
        merchant = _make_user("m1")
        self.store = _make_store(merchant)
        self.template = _make_template(self.store)
        # 3 attempts for user A, 1 for user B
        for _ in range(3):
            DailyDrawAttempt.objects.create(
                user=self.user_a, template=self.template, success=False, draw_probability=0.5
            )
        DailyDrawAttempt.objects.create(
            user=self.user_b, template=self.template, success=True, draw_probability=0.5
        )
        self.url = reverse("admin:api_studentprofile_draw_history", args=[self.profile_a.id])

    def test_requires_staff(self):
        non_staff = _make_user("nobody")
        self.client.force_login(non_staff)
        resp = self.client.get(self.url)
        # Django admin redirects unauth users to its login page.
        self.assertEqual(resp.status_code, 302)
        self.assertIn("/admin/login", resp["Location"])

    def test_returns_200_for_staff_and_lists_only_target_user_attempts(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        # User A has 3 attempts in context, user B's attempt MUST NOT appear.
        attempts = list(resp.context["page_obj"].object_list)
        self.assertEqual(len(attempts), 3)
        self.assertTrue(all(a.user_id == self.user_a.id for a in attempts))

    def test_paginates_at_50_per_page(self):
        # Push beyond the page size to confirm pagination is wired.
        for _ in range(55):
            DailyDrawAttempt.objects.create(
                user=self.user_a, template=self.template, success=False, draw_probability=0.5
            )
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(len(resp.context["page_obj"].object_list), 50)
        self.assertTrue(resp.context["page_obj"].has_next())


# ─────────────────────────────────────────────────────────────────────────────
# 3. /admin/api/studentprofile/<id>/spin-history/
# ─────────────────────────────────────────────────────────────────────────────


class SpinHistoryAdminViewTest(TestCase):
    def setUp(self):
        self.admin = _make_user("admin2", is_staff=True, is_superuser=True)
        self.user_a = _make_user("sa")
        self.user_b = _make_user("sb")
        self.profile_a = StudentProfile.objects.create(user=self.user_a, phone_number="0900000020")
        StudentProfile.objects.create(user=self.user_b, phone_number="0900000021")
        # 2 spinner tx for A, 1 non-spinner tx for A, 1 spinner tx for B
        Wallet.objects.create(user=self.user_a, gems=10, cou_points=0)
        Wallet.objects.create(user=self.user_b, gems=10, cou_points=0)
        WalletTransaction.objects.create(
            user=self.user_a,
            kind=WalletTransaction.Kind.SPINNER_SOLO,
            delta_gems=-1,
            delta_cou_points=3,
            balance_after_gems=9,
            balance_after_cou_points=3,
        )
        WalletTransaction.objects.create(
            user=self.user_a,
            kind=WalletTransaction.Kind.SPINNER_COOP,
            delta_gems=-2,
            delta_cou_points=8,
            balance_after_gems=7,
            balance_after_cou_points=11,
        )
        WalletTransaction.objects.create(
            user=self.user_a,
            kind=WalletTransaction.Kind.SEED,
            delta_gems=3,
            delta_cou_points=0,
            balance_after_gems=10,
            balance_after_cou_points=0,
        )
        WalletTransaction.objects.create(
            user=self.user_b,
            kind=WalletTransaction.Kind.SPINNER_SOLO,
            delta_gems=-1,
            delta_cou_points=2,
            balance_after_gems=9,
            balance_after_cou_points=2,
        )
        self.url = reverse("admin:api_studentprofile_spin_history", args=[self.profile_a.id])

    def test_requires_staff(self):
        non_staff = _make_user("nobody2")
        self.client.force_login(non_staff)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 302)
        self.assertIn("/admin/login", resp["Location"])

    def test_only_spinner_transactions_for_target_user(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        rows = list(resp.context["page_obj"].object_list)
        # 2 spinner rows for user A, no SEED row, no user B rows.
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(r.user_id == self.user_a.id for r in rows))
        kinds = {r.kind for r in rows}
        self.assertSetEqual(kinds, {"spinner_solo", "spinner_coop"})
        self.assertNotIn("seed", kinds)


# ─────────────────────────────────────────────────────────────────────────────
# 4. /admin/api/studentprofile/<id>/holdings/
# ─────────────────────────────────────────────────────────────────────────────


class HoldingsAdminViewTest(TestCase):
    def setUp(self):
        self.admin = _make_user("admin3", is_staff=True, is_superuser=True)
        self.user_a = _make_user("ha")
        self.user_b = _make_user("hb")
        self.profile_a = StudentProfile.objects.create(user=self.user_a, phone_number="0900000030")
        StudentProfile.objects.create(user=self.user_b, phone_number="0900000031")
        merchant = _make_user("hm")
        self.store = _make_store(merchant)
        now = timezone.now()

        # Two coupons held by A, one held by B.
        for i in range(2):
            Coupon.objects.create(
                store=self.store,
                coupon_name=f"A's Coupon {i}",
                coupon_detail="x",
                start_date=now - timezone.timedelta(days=1),
                expiry_date=now + timezone.timedelta(days=7),
                coupon_type="exclusive",
                original_owner=self.user_a,
                current_holder=self.user_a,
                acquisition_method="draw",
            )
        Coupon.objects.create(
            store=self.store,
            coupon_name="B's Coupon",
            coupon_detail="x",
            start_date=now - timezone.timedelta(days=1),
            expiry_date=now + timezone.timedelta(days=7),
            coupon_type="exclusive",
            original_owner=self.user_b,
            current_holder=self.user_b,
            acquisition_method="draw",
        )

        # One platform voucher held by A.
        PlatformVoucher.objects.create(
            face_value=Decimal("10.00"),
            currency_code="TWD",
            redeem_code="ABCDEFGH",
            start_date=now - timezone.timedelta(days=1),
            expiry_date=now + timezone.timedelta(days=30),
            original_owner=self.user_a,
            current_holder=self.user_a,
            acquisition_method="reward",
            batch_name="Sharing Reward",
        )

        self.url = reverse("admin:api_studentprofile_holdings", args=[self.profile_a.id])

    def test_requires_staff(self):
        non_staff = _make_user("nobody3")
        self.client.force_login(non_staff)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 302)
        self.assertIn("/admin/login", resp["Location"])

    def test_returns_user_a_holdings_only(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        coupons = list(resp.context["coupons_page"].object_list)
        vouchers = list(resp.context["vouchers_page"].object_list)
        self.assertEqual(len(coupons), 2)
        self.assertTrue(all(c.current_holder_id == self.user_a.id for c in coupons))
        self.assertEqual(len(vouchers), 1)
        self.assertEqual(vouchers[0].current_holder_id, self.user_a.id)

    def test_does_not_leak_coupons_owned_by_other_users(self):
        """Regression guard: a sloppy filter could leak user B's coupons into
        user A's holdings page. Explicit assertion."""
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        coupon_names = {c.coupon_name for c in resp.context["coupons_page"].object_list}
        self.assertNotIn("B's Coupon", coupon_names)

    def test_paginates_coupons_at_50_per_page(self):
        now = timezone.now()
        for i in range(55):
            Coupon.objects.create(
                store=self.store,
                coupon_name=f"Extra {i}",
                coupon_detail="x",
                start_date=now - timezone.timedelta(days=1),
                expiry_date=now + timezone.timedelta(days=7),
                coupon_type="exclusive",
                original_owner=self.user_a,
                current_holder=self.user_a,
                acquisition_method="transfer",
            )
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(len(resp.context["coupons_page"].object_list), 50)
        self.assertTrue(resp.context["coupons_page"].has_next())
