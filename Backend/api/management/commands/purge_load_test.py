"""
Safely purge all load test data from the database.

Identifies users by username prefix (loadtest_merchant_ / loadtest_student_)
and email domain (@loadtest.local) — the same conventions used in seed_load_test.py.

Deletion order matters because Store.owner is SET_NULL (not CASCADE):
  1. Stores owned by loadtest merchants  →  cascades Coupon, CouponTemplate,
     CouponShareRequest, QRCodeSession/Claim, BlockedMerchant, etc.
  2. Loadtest User rows  →  cascades StudentProfile, MerchantProfile,
     CouponRedemption, PhoneOTPRecord, CompletedGoal, EULAAcceptance, etc.

Usage:
    # Dry-run (safe — prints counts, touches nothing):
    python manage.py purge_load_test

    # Actually delete:
    python manage.py purge_load_test --confirm
"""

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Store

USERNAME_PREFIXES = ("loadtest_merchant_", "loadtest_student_")
EMAIL_DOMAIN = "@loadtest.local"


def _get_loadtest_users():
    return User.objects.filter(email__endswith=EMAIL_DOMAIN).filter(
        username__startswith="loadtest_"
    )


def _get_loadtest_merchant_users():
    return _get_loadtest_users().filter(username__startswith="loadtest_merchant_")


def _get_loadtest_stores(merchant_qs):
    return Store.objects.filter(owner__in=merchant_qs)


class Command(BaseCommand):
    help = (
        "Purge all load test users and their associated data. "
        "Run without --confirm for a safe dry-run first."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            default=False,
            help="Actually delete the data. Without this flag, only a dry-run is performed.",
        )

    def handle(self, *args, **options):
        confirm = options["confirm"]

        merchants = _get_loadtest_merchant_users()
        all_users = _get_loadtest_users()
        stores = _get_loadtest_stores(merchants)

        merchant_count = merchants.count()
        student_count = all_users.filter(username__startswith="loadtest_student_").count()
        store_count = stores.count()
        total_users = all_users.count()

        # ── Dry-run summary ──────────────────────────────────────────────────
        self.stdout.write(self.style.WARNING("=" * 60))
        self.stdout.write(self.style.WARNING("  LOAD TEST DATA PURGE SUMMARY"))
        self.stdout.write(self.style.WARNING("=" * 60))
        self.stdout.write(f"  Merchant users    : {merchant_count}")
        self.stdout.write(f"  Student users     : {student_count}")
        self.stdout.write(f"  Total users       : {total_users}")
        self.stdout.write(f"  Stores to delete  : {store_count}")
        self.stdout.write("")

        if merchant_count == 0 and student_count == 0:
            self.stdout.write(self.style.SUCCESS("No load test data found. Nothing to do."))
            return

        # Safety check — make sure we are only targeting @loadtest.local accounts
        non_loadtest = all_users.exclude(email__endswith=EMAIL_DOMAIN)
        if non_loadtest.exists():
            self.stdout.write(
                self.style.ERROR(
                    f"ABORT: {non_loadtest.count()} user(s) matched username prefix "
                    f"but do NOT have {EMAIL_DOMAIN} email. This should never happen. "
                    "Inspect manually before proceeding."
                )
            )
            return

        if not confirm:
            self.stdout.write(
                self.style.NOTICE(
                    "DRY-RUN complete. No data was changed.\n"
                    "Re-run with --confirm to actually delete."
                )
            )
            return

        # ── Actual deletion (inside a transaction) ───────────────────────────
        self.stdout.write(self.style.WARNING("Starting deletion..."))

        with transaction.atomic():
            # Step 1: Delete stores first (Store.owner is SET_NULL, not CASCADE).
            # Deleting the Store row cascades to: Coupon, CouponTemplate,
            # QRCodeSession, QRCodeClaim, BlockedMerchant,
            # PlatformVoucherRedemption (via store FK), etc.
            deleted_stores, store_detail = stores.delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Deleted {deleted_stores} store-related rows: {store_detail}"
                )
            )

            # Step 2: Delete all loadtest users.
            # Cascades to: StudentProfile, MerchantProfile, CouponRedemption,
            # PhoneOTPRecord, CompletedGoal, EULAAcceptance, ViolationRecord,
            # ContentReport (as reporter), CouponShareRequest (as from_user), etc.
            deleted_users, user_detail = all_users.delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Deleted {deleted_users} user-related rows: {user_detail}"
                )
            )

        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(
            self.style.SUCCESS(
                f"  Purge complete. "
                f"{deleted_stores + deleted_users} total rows removed."
            )
        )
        self.stdout.write(self.style.SUCCESS("=" * 60))
