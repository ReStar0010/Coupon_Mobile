#!/usr/bin/env python
"""
One-shot local QA seed: Web 旅程 fixtures + 現金券核銷測試用帳號／店家 6 碼／一張未核銷現金券。

前置：已執行過 migrate。

Usage:
  cd Backend && source .venv/bin/activate
  python scripts/seed_qa_local.py

環境變數（可選）：
  WEB_BASE_URL   預設 http://localhost:3000
  API_BASE_URL   預設 http://127.0.0.1:8000
"""
from __future__ import annotations

import importlib.util
import os
import secrets
import sys
from decimal import Decimal
from pathlib import Path
from datetime import timedelta

import django

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Backend.settings")
django.setup()

from django.contrib.auth.models import User  # noqa: E402
from django.utils import timezone  # noqa: E402

from api.models import PlatformVoucher, PlatformVoucherRedemption, Store, StudentProfile  # noqa: E402
from api.utils import generate_platform_voucher_redeem_code  # noqa: E402


def _load_seed_web():
    path = BASE_DIR / "scripts" / "seed_web_user_journey.py"
    spec = importlib.util.spec_from_file_location("seed_web_user_journey", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _pick_unified_code() -> str:
    for code in ("888888", "877777", "866666", "855555", "844444"):
        if not Store.objects.filter(unified_redeem_code=code).exists():
            return code
    return "".join(str(secrets.randbelow(10)) for _ in range(6))


def seed_voucher_qa(store: Store) -> tuple[User, PlatformVoucher, str]:
    """
    同一間 Demo 店家：開通 6 碼核銷 + 接受平台現金券；建立持券測試用戶。
    回傳 (consumer, voucher, unified_6_digits)
    """
    code = _pick_unified_code()
    store.unified_redeem_code = code
    store.accepts_platform_vouchers = True
    store.save(update_fields=["unified_redeem_code", "accepts_platform_vouchers"])

    consumer, _ = User.objects.get_or_create(
        username="qa_voucher_consumer",
        defaults={"email": "qa-voucher-consumer@local.test"},
    )
    if consumer.email != "qa-voucher-consumer@local.test":
        consumer.email = "qa-voucher-consumer@local.test"
        consumer.save(update_fields=["email"])
    consumer.set_password("qa-testpass-2026")
    consumer.save()

    profile, _ = StudentProfile.objects.get_or_create(
        user=consumer,
        defaults={"phone_number": "0922000002"},
    )
    if profile.phone_number != "0922000002":
        profile.phone_number = "0922000002"
        profile.save(update_fields=["phone_number"])

    now = timezone.now()
    redeemed = PlatformVoucherRedemption.objects.values_list("voucher_id", flat=True)
    voucher = (
        PlatformVoucher.objects.filter(current_holder=consumer, batch_name="QA Local Seed")
        .exclude(id__in=redeemed)
        .first()
    )
    if not voucher:
        voucher = PlatformVoucher.objects.create(
            face_value=Decimal("50.00"),
            currency_code="TWD",
            start_date=now - timedelta(days=1),
            expiry_date=now + timedelta(days=365),
            current_holder=consumer,
            original_owner=consumer,
            redeem_code=generate_platform_voucher_redeem_code(),
            batch_name="QA Local Seed",
            acquisition_method="platform_issue",
        )
    elif not voucher.redeem_code:
        voucher.redeem_code = generate_platform_voucher_redeem_code()
        voucher.save(update_fields=["redeem_code"])

    return consumer, voucher, code


def main() -> None:
    web = _load_seed_web()
    merchant, sharer = web.upsert_users()
    store = web.upsert_store(merchant)
    template = web.upsert_template(store)
    session = web.upsert_qr_session(template, merchant)
    share_coupon = web.upsert_share_coupon(template, store, sharer)
    web.upsert_share_request(share_coupon, sharer)
    web.seed_points_history(template)

    consumer, voucher, unified_code = seed_voucher_qa(store)

    web_base = os.getenv("WEB_BASE_URL", "http://localhost:3000").rstrip("/")
    api_base = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

    print("=" * 72)
    print("QA local seed 完成（Web 旅程 + 現金券核銷）")
    print("=" * 72)
    print(f"店家 6 碼核銷碼（unified_redeem_code）: {unified_code}")
    print(f"現金券測試帳號: username={consumer.username!r}  password=qa-testpass-2026")
    print(f"  對應 StudentProfile 手機: 0922000002")
    print(f"PlatformVoucher id: {voucher.id}  面額: {voucher.face_value} {voucher.currency_code}")
    print("-" * 72)
    print("列印 QR 測試：請用產生器輸出「純文字」為以下 6 位數（或含在 URL 中）")
    print(f"  {unified_code}")
    print("-" * 72)
    print("Web（任務一）快速連結：")
    print(f"  Claim:     {web_base}/w/claim/{session.session_token}")
    print(f"  Points:    {web_base}/w/points?session={session.session_token}")
    print(f"  API 對照:  GET {api_base}/api/web/v1/sessions/{session.session_token}/resolve/")
    print("-" * 72)
    print("累點測試手機（已預先 2 筆 WebRedemption）：", web.FIXTURE["points_phone"])
    print("=" * 72)


if __name__ == "__main__":
    main()
