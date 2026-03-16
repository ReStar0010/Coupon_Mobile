"""
Management command: recompute_progress

Recomputes sharing_progress_count and referral_progress_count for all users
from scratch based on redemption history. Does NOT re-grant reward vouchers
(those are already in user wallets). Use this as a safety net to fix counter
drift caused by bugs or data migrations.

Usage:
    python manage.py recompute_progress
    python manage.py recompute_progress --dry-run
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class Command(BaseCommand):
    help = "Recompute sharing_progress_count and referral_progress_count for all users from redemption history."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print computed counts without saving to the database.',
        )

    def handle(self, *args, **options):
        from api.models import StudentProfile, CouponRedemption, PlatformVoucherRedemption

        dry_run = options['dry_run']
        users = User.objects.select_related('student_profile').all()
        updated = 0
        skipped = 0

        self.stdout.write("Computing sharing_progress_count and referral_progress_count...")

        # --- Metric 3 (referral): build a map of referrer_id -> count ---
        # For each user B, find B's first-ever exclusive coupon OR voucher redemption.
        # If the source (original_owner) is user A (and A != B), increment A's referral count.
        referral_counts: dict[int, int] = {}

        all_users = list(users)
        for user_b in all_users:
            # First exclusive coupon redemption by this user
            first_exclusive = (
                CouponRedemption.objects
                .filter(user=user_b, coupon_type='exclusive')
                .select_related('coupon__original_owner')
                .order_by('redeemed_at')
                .first()
            )
            # First platform voucher redemption by this user
            first_voucher = (
                PlatformVoucherRedemption.objects
                .filter(user=user_b)
                .select_related('voucher__original_owner')
                .order_by('redeemed_at')
                .first()
            )

            # Determine which came first chronologically
            first_kind = None
            first_obj = None
            if first_exclusive and first_voucher:
                if first_exclusive.redeemed_at <= first_voucher.redeemed_at:
                    first_kind, first_obj = 'coupon', first_exclusive
                else:
                    first_kind, first_obj = 'voucher', first_voucher
            elif first_exclusive:
                first_kind, first_obj = 'coupon', first_exclusive
            elif first_voucher:
                first_kind, first_obj = 'voucher', first_voucher

            if first_obj is None:
                continue

            if first_kind == 'coupon':
                source_owner = first_obj.coupon.original_owner
            else:
                source_owner = first_obj.voucher.original_owner

            if source_owner and source_owner.id != user_b.id:
                referral_counts[source_owner.id] = referral_counts.get(source_owner.id, 0) + 1

        # --- Apply updates ---
        for user in all_users:
            try:
                profile = user.student_profile
            except StudentProfile.DoesNotExist:
                skipped += 1
                continue

            # Metric 2 — sharing_progress_count (COU-87: any redemption counts, not just shared)
            # redeemer_count: user redeemed any exclusive coupon (light on for every redemption)
            redeemer_count = CouponRedemption.objects.filter(
                user=user,
                coupon_type='exclusive',
            ).count()

            # owner_count: user is original_owner of exclusive coupon redeemed by someone else
            owner_count = CouponRedemption.objects.filter(
                coupon__original_owner=user,
                coupon_type='exclusive',
            ).exclude(user=user).count()

            # Metric 2 resets to 0 when reaching 3; store current cycle remainder (0..2).
            total_sharing = redeemer_count + owner_count
            new_sharing = total_sharing % 3
            new_sharing_rewards = total_sharing // 3

            # Metric 3 — referral_progress_count
            new_referral = referral_counts.get(user.id, 0)

            old_sharing = profile.sharing_progress_count
            old_referral = profile.referral_progress_count
            old_sharing_rewards = getattr(profile, 'sharing_rewards_earned', 0)

            if dry_run:
                if (new_sharing != old_sharing or new_referral != old_referral
                        or new_sharing_rewards != old_sharing_rewards):
                    self.stdout.write(
                        f"  [DRY-RUN] user={user.email} "
                        f"sharing: {old_sharing} → {new_sharing}, "
                        f"sharing_rewards: {old_sharing_rewards} → {new_sharing_rewards}, "
                        f"referral: {old_referral} → {new_referral}"
                    )
            else:
                if (new_sharing != old_sharing or new_referral != old_referral
                        or new_sharing_rewards != old_sharing_rewards):
                    profile.sharing_progress_count = new_sharing
                    profile.sharing_rewards_earned = new_sharing_rewards
                    profile.referral_progress_count = new_referral
                    profile.save(update_fields=[
                        'sharing_progress_count', 'sharing_rewards_earned', 'referral_progress_count'
                    ])
                    updated += 1

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run complete. No changes saved."))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Done. Updated {updated} profiles, skipped {skipped} (no StudentProfile)."
                )
            )
