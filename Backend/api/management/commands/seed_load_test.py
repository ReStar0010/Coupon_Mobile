"""
Versioned seed for load test stages.
Creates N merchants (with stores + store coupons), P test users.
Writes test user credentials to load_tests/config/test_users.json for Locust.
N, P derived from STAGE or SEED_MERCHANTS, SEED_USERS env.
"""
import json
import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from django.utils import timezone
from django.db import transaction

from api.models import (
    Store,
    Coupon,
    CouponTemplate,
    StudentProfile,
    MerchantProfile,
)
from api.utils import generate_unified_redemption_code

LOADTEST_PASSWORD = "loadtest123"
USERNAME_PREFIX_MERCHANT = "loadtest_merchant_"
USERNAME_PREFIX_STUDENT = "loadtest_student_"


def get_stage_params():
    stage = int(os.environ.get("STAGE", "1"))
    if stage == 1:
        return 1, 200
    if stage == 2:
        return 1, 1000
    if stage == 3:
        return 50, 1500
    if stage == 4:
        return 50, 5000
    n = int(os.environ.get("SEED_MERCHANTS", "1"))
    p = int(os.environ.get("SEED_USERS", "200"))
    return n, p


def ensure_unique_code(exclude_store_id=None):
    for _ in range(20):
        code = generate_unified_redemption_code()
        qs = Store.objects.filter(unified_redeem_code=code)
        if exclude_store_id:
            qs = qs.exclude(id=exclude_store_id)
        if not qs.exists():
            return code
    return generate_unified_redemption_code()


class Command(BaseCommand):
    help = "Seed load test data: N merchants (stores + coupons), P test users. Writes credentials to load_tests/config/test_users.json."

    def add_arguments(self, parser):
        parser.add_argument(
            "--stage",
            type=int,
            default=None,
            help="Override STAGE env (1-4).",
        )
        parser.add_argument(
            "--merchants",
            type=int,
            default=None,
            help="Override number of merchants.",
        )
        parser.add_argument(
            "--users",
            type=int,
            default=None,
            help="Override number of test users.",
        )

    def handle(self, *args, **options):
        stage_override = options.get("stage")
        if stage_override is not None:
            os.environ["STAGE"] = str(stage_override)
        n_merchants, n_users = get_stage_params()
        if options.get("merchants") is not None:
            n_merchants = options["merchants"]
        if options.get("users") is not None:
            n_users = options["users"]

        self.stdout.write(
            self.style.NOTICE(
                f"Seeding load test: {n_merchants} merchants, {n_users} test users"
            )
        )

        with transaction.atomic():
            merchant_group, _ = Group.objects.get_or_create(name="Merchant")
            credentials = []
            store_codes = []  # store_id -> unified_redeem_code for Locust

            # Create merchants and stores with store-type coupons
            now = timezone.now()
            from datetime import timedelta
            expiry = now + timedelta(days=365)

            for i in range(1, n_merchants + 1):
                username = f"{USERNAME_PREFIX_MERCHANT}{i}"
                email = f"loadtest_merchant_{i}@loadtest.local"
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": email,
                        "first_name": "Load",
                        "last_name": f"Merchant{i}",
                        "is_active": True,
                    },
                )
                user.set_password(LOADTEST_PASSWORD)
                user.save()
                if created:
                    user.groups.add(merchant_group)
                MerchantProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "phone": f"09{i:08d}"[:10],
                        "contact_person": f"Merchant {i}",
                        "contact_info": "loadtest",
                        "verified": True,
                    },
                )

                store, store_created = Store.objects.get_or_create(
                    owner=user,
                    name=f"LoadTest Store {i}",
                    defaults={
                        "lat": 25.03 + (i % 10) * 0.001,
                        "lng": 121.56 + (i % 10) * 0.001,
                        "address": f"LoadTest Address {i}",
                        "business_hours": "09:00-21:00",
                        "store_type": "restaurant",
                    },
                )
                if not store.unified_redeem_code:
                    store.unified_redeem_code = ensure_unique_code(store.id)
                    store.save()
                store_codes.append(
                    {"store_id": store.id, "unified_redeem_code": store.unified_redeem_code}
                )

                # Store-type coupons for browse/redeem (no template)
                for j in range(3):
                    cname = f"LoadTest Coupon {i}-{j}"
                    if not Coupon.objects.filter(
                        store=store, coupon_name=cname, coupon_type="store"
                    ).exists():
                        Coupon.objects.create(
                            store=store,
                            coupon_name=cname,
                            coupon_detail="Load test coupon",
                            start_date=now,
                            expiry_date=expiry,
                            coupon_type="store",
                            usage_per_day="unlimited",
                        )

            # Create test users (students)
            for i in range(1, n_users + 1):
                username = f"{USERNAME_PREFIX_STUDENT}{i}"
                email = f"loadtest_student_{i}@loadtest.local"
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": email,
                        "first_name": "Load",
                        "last_name": f"Student{i}",
                        "is_active": True,
                    },
                )
                user.set_password(LOADTEST_PASSWORD)
                user.save()
                StudentProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "verified": True,
                        "phone_verified": True,
                        "phone_number": f"09{i:08d}"[:10],
                    },
                )
                credentials.append({"email": email, "password": LOADTEST_PASSWORD})

            # Stage 2 idempotency: one exclusive coupon (same coupon_id raced by many users)
            if n_merchants <= 2 and store_codes and credentials:
                from datetime import timedelta
                first_store = Store.objects.get(id=store_codes[0]["store_id"])
                first_student = User.objects.filter(
                    username__startswith=USERNAME_PREFIX_STUDENT
                ).order_by("id").first()
                if first_student:
                    now = timezone.now()
                    expiry = now + timedelta(days=365)
                    tpl, _ = CouponTemplate.objects.get_or_create(
                        store=first_store,
                        coupon_name="LoadTest Exclusive Idempotency",
                        defaults={
                            "coupon_detail": "For idempotency test",
                            "start_date": now,
                            "expiry_date": expiry,
                            "total_quantity": 1,
                            "remaining_quantity": 0,
                            "template_redeem_code": first_store.unified_redeem_code,
                            "is_active": True,
                        },
                    )
                    if not Coupon.objects.filter(
                        store=first_store,
                        coupon_name="LoadTest Exclusive Idempotency",
                        coupon_type="exclusive",
                    ).exists():
                        exc = Coupon.objects.create(
                            store=first_store,
                            template=tpl,
                            coupon_name="LoadTest Exclusive Idempotency",
                            coupon_detail="For idempotency test",
                            start_date=now,
                            expiry_date=expiry,
                            coupon_type="exclusive",
                            original_owner=first_student,
                            current_holder=first_student,
                            redeem_code=first_store.unified_redeem_code,
                            usage_per_day="one-time",
                        )
                        store_codes[0]["shared_exclusive_coupon_id"] = exc.id

        # Write credentials and store codes to load_tests/config/ (repo root relative to Backend)
        out_dir = Path(settings.BASE_DIR).parent / "load_tests" / "config"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / "test_users.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(credentials, f, indent=2)
        stores_file = out_dir / "stores.json"
        with open(stores_file, "w", encoding="utf-8") as f:
            json.dump(store_codes, f, indent=2)
        self.stdout.write(
            self.style.SUCCESS(
                f"Wrote {len(credentials)} credentials to {out_file}, "
                f"{len(store_codes)} stores to {stores_file}"
            )
        )
        self.stdout.write(self.style.SUCCESS("Seed complete."))
