#!/usr/bin/env python
"""
本機開發用：建立手機 0912000001 的測試帳號（等同 OTP 註冊完成後狀態）並確保持有一張未核銷平台現金券。

與正式「手機註冊」差異：略過 SMS OTP，直接寫入 User + StudentProfile。

Usage:
  cd Backend && source .venv/bin/activate
  python scripts/ensure_dev_user_0912000001.py

環境變數（可選）：
  DEV_PHONE_PASSWORD  預設 qa-testpass-2026
"""
from __future__ import annotations

import os
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

from api.models import PlatformVoucher, PlatformVoucherRedemption, StudentProfile  # noqa: E402
from api.utils import generate_platform_voucher_redeem_code  # noqa: E402

PHONE = "0912000001"
BATCH = "Dev seed 0912000001"


def main() -> None:
    password = os.getenv("DEV_PHONE_PASSWORD", "qa-testpass-2026")

    user, created = User.objects.get_or_create(
        username=PHONE,
        defaults={"email": f"{PHONE}@local.dev.test"},
    )
    if created:
        user.set_password(password)
        user.save()
    else:
        user.set_password(password)
        if not user.email:
            user.email = f"{PHONE}@local.dev.test"
        user.save()

    profile, p_created = StudentProfile.objects.get_or_create(
        user=user,
        defaults={
            "phone_number": PHONE,
            "phone_verified": True,
            "verified": False,
        },
    )
    if not p_created:
        if profile.phone_number != PHONE:
            profile.phone_number = PHONE
        profile.phone_verified = True
        profile.save()

    now = timezone.now()
    redeemed_ids = PlatformVoucherRedemption.objects.values_list("voucher_id", flat=True)
    voucher = (
        PlatformVoucher.objects.filter(current_holder=user, batch_name=BATCH)
        .exclude(id__in=redeemed_ids)
        .first()
    )
    if not voucher:
        voucher = PlatformVoucher.objects.create(
            face_value=Decimal("50.00"),
            currency_code="TWD",
            start_date=now - timedelta(days=1),
            expiry_date=now + timedelta(days=365),
            current_holder=user,
            original_owner=user,
            redeem_code=generate_platform_voucher_redeem_code(),
            batch_name=BATCH,
            acquisition_method="platform_issue",
        )

    print("=" * 60)
    print("本機測試帳號已就緒（略過 OTP，等同註冊完成）")
    print("=" * 60)
    print(f"  手機 / 登入帳號: {PHONE}")
    print(f"  密碼:            {password}")
    print(f"  StudentProfile:  phone_number={profile.phone_number}  phone_verified={profile.phone_verified}")
    print(f"  PlatformVoucher: id={voucher.id}  face_value={voucher.face_value} {voucher.currency_code} (未核銷)")
    print("=" * 60)
    print("在 App 使用「手機 + 密碼」登入即可在收藏／現金券看到上述一張券。")


if __name__ == "__main__":
    main()
