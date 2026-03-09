"""
Versioned seed for load test stages.
Creates N merchants (with stores + store coupons), P test users.
Writes test user credentials to load_tests/config/test_users.json for Locust.
N, P derived from STAGE or SEED_MERCHANTS, SEED_USERS env.
Stage 3+: also creates exclusive coupons, public pool share, private shares, daily-draw template.
"""
import json
import os
import secrets
from datetime import timedelta
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
    CouponShareRequest,
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


def run_seed(
    stage: int,
    n_merchants: int | None = None,
    n_users: int | None = None,
) -> tuple[list[dict], list[dict], list[str]]:
    """
    Run seed logic for the given stage. Returns (credentials, store_codes, private_share_tokens).
    Does not write files; caller may write to load_tests/config/ or return config in API response.
    """
    os.environ["STAGE"] = str(stage)
    n, p = get_stage_params()
    if n_merchants is not None:
        n = n_merchants
    if n_users is not None:
        p = n_users

    private_share_tokens: list[str] = []
    with transaction.atomic():
        merchant_group, _ = Group.objects.get_or_create(name="Merchant")
        credentials: list[dict] = []
        store_codes: list[dict] = []  # store_id, unified_redeem_code for Locust

        now = timezone.now()
        expiry = now + timedelta(days=365)

        for i in range(1, n + 1):
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

            store, _ = Store.objects.get_or_create(
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

        for i in range(1, p + 1):
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

        # Stage 2 idempotency: one exclusive coupon
        if n <= 2 and store_codes and credentials:
            first_store = Store.objects.get(id=store_codes[0]["store_id"])
            first_student = User.objects.filter(
                username__startswith=USERNAME_PREFIX_STUDENT
            ).order_by("id").first()
            if first_student:
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

        # Stage 3+: full flow
        if n >= 3 and store_codes and credentials:
            first_store = Store.objects.get(id=store_codes[0]["store_id"])
            CouponTemplate.objects.filter(
                store=first_store, coupon_name="LoadTest Daily Draw"
            ).delete()
            students = list(
                User.objects.filter(username__startswith=USERNAME_PREFIX_STUDENT)
                .order_by("id")[:80]
            )
            if students:
                tpl = CouponTemplate.objects.create(
                    store=first_store,
                    coupon_name="LoadTest Daily Draw",
                    coupon_detail="For daily draw and sharing load test",
                    start_date=now,
                    expiry_date=expiry,
                    total_quantity=150,
                    remaining_quantity=150,
                    template_redeem_code=first_store.unified_redeem_code,
                    is_active=True,
                    draw_probability=0.5,
                )
                exclusive_coupons = []
                for student in students:
                    c = tpl.generate_coupon(recipient=student)
                    if c:
                        exclusive_coupons.append((c, student))
                if exclusive_coupons:
                    pub_coupon, pub_owner = exclusive_coupons[0]
                    CouponShareRequest.objects.create(
                        coupon=pub_coupon,
                        from_user=pub_owner,
                        token=secrets.token_urlsafe(32),
                        is_public=True,
                        status="pending",
                        to_user=None,
                    )
                    pub_coupon.last_holder = pub_coupon.current_holder
                    pub_coupon.current_holder = None
                    pub_coupon.save()
                for (c, holder) in exclusive_coupons[1:41]:
                    token = secrets.token_urlsafe(32)
                    CouponShareRequest.objects.create(
                        coupon=c,
                        from_user=holder,
                        token=token,
                        is_public=False,
                        status="pending",
                        to_user=None,
                    )
                    private_share_tokens.append(token)

    return (credentials, store_codes, private_share_tokens)


def seed_from_config(
    config: dict,
    stage: int,
) -> tuple[list[dict], list[dict], list[str]]:
    """
    Seed DB from an existing config (test_users, stores with unified_redeem_code).
    Returns (credentials, store_codes, private_share_tokens) with actual store_id from this DB.
    Used when local/remote use a single pushed config; stage only controls idempotency and stage 3+ features.
    """
    test_users = config.get("test_users") or []
    stores_config = config.get("stores") or []
    private_share_tokens = list(config.get("private_share_tokens") or [])

    if not test_users or not stores_config:
        raise ValueError("config must contain non-empty test_users and stores")

    credentials = [{"email": u.get("email"), "password": u.get("password", LOADTEST_PASSWORD)} for u in test_users]
    # Normalize to strings for consistency
    for c in credentials:
        if c["email"] is None:
            raise ValueError("test_users entry missing email")
        c["password"] = c["password"] or LOADTEST_PASSWORD

    n_stores = len(stores_config)
    n_users = len(test_users)

    with transaction.atomic():
        merchant_group, _ = Group.objects.get_or_create(name="Merchant")
        store_codes: list[dict] = []
        now = timezone.now()
        expiry = now + timedelta(days=365)

        # Create merchants and stores with unified_redeem_code from config
        for i in range(1, n_stores + 1):
            store_cfg = stores_config[i - 1]
            redeem_code = store_cfg.get("unified_redeem_code") or ensure_unique_code()
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
            store, _ = Store.objects.get_or_create(
                owner=user,
                name=f"LoadTest Store {i}",
                defaults={
                    "lat": 25.03 + (i % 10) * 0.001,
                    "lng": 121.56 + (i % 10) * 0.001,
                    "address": f"LoadTest Address {i}",
                    "business_hours": "09:00-21:00",
                    "store_type": "restaurant",
                    "unified_redeem_code": redeem_code,
                },
            )
            if store.unified_redeem_code != redeem_code:
                store.unified_redeem_code = redeem_code
                store.save()
            store_codes.append({"store_id": store.id, "unified_redeem_code": store.unified_redeem_code})

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

        # Create users from config test_users (email + password); use loadtest_student_N for ordering
        for i, u in enumerate(test_users):
            email = u.get("email")
            password = u.get("password") or LOADTEST_PASSWORD
            if not email:
                continue
            username = f"{USERNAME_PREFIX_STUDENT}{i + 1}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": "Load",
                    "last_name": f"Student{i + 1}",
                    "is_active": True,
                },
            )
            if not created and user.email != email:
                user.email = email
                user.save()
            user.set_password(password)
            user.save()
            if created:
                StudentProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "verified": True,
                        "phone_verified": True,
                        "phone_number": f"09{(i + 1):08d}"[:10],
                    },
                )

        # Stage 2 idempotency
        if stage >= 2 and store_codes and n_stores >= 1:
            first_store = Store.objects.get(id=store_codes[0]["store_id"])
            first_student = User.objects.filter(
                username__startswith=USERNAME_PREFIX_STUDENT
            ).order_by("id").first()
            if first_student:
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

        # Stage 3+: daily draw, public pool, private shares (use config tokens)
        if stage >= 3 and store_codes and n_stores >= 1:
            first_store = Store.objects.get(id=store_codes[0]["store_id"])
            CouponTemplate.objects.filter(
                store=first_store, coupon_name="LoadTest Daily Draw"
            ).delete()
            students = list(
                User.objects.filter(username__startswith=USERNAME_PREFIX_STUDENT)
                .order_by("id")[:80]
            )
            if students:
                tpl = CouponTemplate.objects.create(
                    store=first_store,
                    coupon_name="LoadTest Daily Draw",
                    coupon_detail="For daily draw and sharing load test",
                    start_date=now,
                    expiry_date=expiry,
                    total_quantity=150,
                    remaining_quantity=150,
                    template_redeem_code=first_store.unified_redeem_code,
                    is_active=True,
                    draw_probability=0.5,
                )
                exclusive_coupons = []
                for student in students:
                    c = tpl.generate_coupon(recipient=student)
                    if c:
                        exclusive_coupons.append((c, student))
                if exclusive_coupons:
                    pub_coupon, pub_owner = exclusive_coupons[0]
                    CouponShareRequest.objects.create(
                        coupon=pub_coupon,
                        from_user=pub_owner,
                        token=secrets.token_urlsafe(32),
                        is_public=True,
                        status="pending",
                        to_user=None,
                    )
                    pub_coupon.last_holder = pub_coupon.current_holder
                    pub_coupon.current_holder = None
                    pub_coupon.save()
                for idx, (c, holder) in enumerate(exclusive_coupons[1:41]):
                    token = private_share_tokens[idx] if idx < len(private_share_tokens) else secrets.token_urlsafe(32)
                    CouponShareRequest.objects.create(
                        coupon=c,
                        from_user=holder,
                        token=token,
                        is_public=False,
                        status="pending",
                        to_user=None,
                    )
                    if idx >= len(private_share_tokens):
                        private_share_tokens.append(token)

    return (credentials, store_codes, private_share_tokens)


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
        stage = int(os.environ.get("STAGE", "1"))
        n_merchants = options.get("merchants")
        n_users = options.get("users")

        self.stdout.write(
            self.style.NOTICE(
                f"Seeding load test for stage {stage}..."
            )
        )

        credentials, store_codes, private_share_tokens = run_seed(
            stage, n_merchants=n_merchants, n_users=n_users
        )

        out_dir = Path(settings.BASE_DIR).parent / "load_tests" / "config"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / "test_users.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(credentials, f, indent=2)
        stores_file = out_dir / "stores.json"
        with open(stores_file, "w", encoding="utf-8") as f:
            json.dump(store_codes, f, indent=2)
        if stage >= 3 and private_share_tokens:
            tokens_file = out_dir / "private_share_tokens.json"
            with open(tokens_file, "w", encoding="utf-8") as f:
                json.dump(private_share_tokens, f, indent=2)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Wrote {len(private_share_tokens)} private share tokens to {tokens_file}"
                )
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"Wrote {len(credentials)} credentials to {out_file}, "
                f"{len(store_codes)} stores to {stores_file}"
            )
        )
        self.stdout.write(self.style.SUCCESS("Seed complete."))
