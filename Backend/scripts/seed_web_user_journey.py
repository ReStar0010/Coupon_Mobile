#!/usr/bin/env python
"""
Seed local data for the web-based user journey.

Creates deterministic fixtures for:
- /w/claim/<session_token> flow (QR session -> merchant -> coupon -> scanner -> redemption)
- /w/share/<share_token> flow (share landing -> coupon page)
- points accumulation branch (pre-seeded phone number points)

Usage:
  cd Backend
  source .venv/bin/activate
  python scripts/seed_web_user_journey.py
"""
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

from api.models import (  # noqa: E402
    Store,
    CouponTemplate,
    QRCodeSession,
    Coupon,
    CouponShareRequest,
    WebRedemption,
)


FIXTURE = {
    "merchant_username": "web_journey_merchant",
    "merchant_email": "web-journey-merchant@local.test",
    "sharer_username": "web_journey_sharer",
    "sharer_email": "web-journey-sharer@local.test",
    "store_name": "Web Journey Demo Store",
    "template_name": "內用飲品 85 折",
    "session_token": "web-journey-session-token-0001",
    "share_token": "web-journey-share-token-0001",
    "points_phone": "0912000001",
}


def upsert_users() -> tuple[User, User]:
    merchant, _ = User.objects.get_or_create(
        username=FIXTURE["merchant_username"],
        defaults={
            "email": FIXTURE["merchant_email"],
            "first_name": "Web",
            "last_name": "Merchant",
        },
    )
    if merchant.email != FIXTURE["merchant_email"]:
        merchant.email = FIXTURE["merchant_email"]
        merchant.save(update_fields=["email"])

    sharer, _ = User.objects.get_or_create(
        username=FIXTURE["sharer_username"],
        defaults={
            "email": FIXTURE["sharer_email"],
            "first_name": "Web",
            "last_name": "Sharer",
        },
    )
    if sharer.email != FIXTURE["sharer_email"]:
        sharer.email = FIXTURE["sharer_email"]
        sharer.save(update_fields=["email"])

    return merchant, sharer


def upsert_store(merchant: User) -> Store:
    store, _ = Store.objects.get_or_create(
        owner=merchant,
        name=FIXTURE["store_name"],
        defaults={
            "address": "台北市信義區松壽路 20 號",
            "lat": 25.0330,
            "lng": 121.5654,
            "store_type": "restaurant",
            "business_hours": "每日 10:00-21:00",
        },
    )
    return store


def upsert_template(store: Store) -> CouponTemplate:
    now = timezone.now()
    template, _ = CouponTemplate.objects.get_or_create(
        store=store,
        coupon_name=FIXTURE["template_name"],
        defaults={
            "coupon_detail": "出示本券即可享飲品 85 折。",
            "important_notes": "每人每日限用一次；不得與其他優惠併用。",
            "estimated_savings": Decimal("45.00"),
            "total_quantity": 200,
            "remaining_quantity": 200,
            "start_date": now - timedelta(days=3),
            "expiry_date": now + timedelta(days=30),
            "draw_probability": 1.0,
            "is_active": True,
        },
    )

    needs_update = False
    if not template.is_active:
        template.is_active = True
        needs_update = True
    if template.remaining_quantity < 5:
        template.remaining_quantity = 200
        needs_update = True
    if template.expiry_date <= now:
        template.expiry_date = now + timedelta(days=30)
        needs_update = True
    if template.start_date >= now:
        template.start_date = now - timedelta(days=3)
        needs_update = True
    if needs_update:
        template.save()

    return template


def upsert_qr_session(template: CouponTemplate, merchant: User) -> QRCodeSession:
    session, _ = QRCodeSession.objects.update_or_create(
        session_token=FIXTURE["session_token"],
        defaults={
            "template": template,
            "merchant": merchant,
            "is_active": True,
            "invalidated_at": None,
        },
    )
    return session


def upsert_share_coupon(template: CouponTemplate, store: Store, sharer: User) -> Coupon:
    now = timezone.now()
    coupon, _ = Coupon.objects.get_or_create(
        store=store,
        template=template,
        coupon_name=f"{FIXTURE['template_name']}（分享券）",
        current_holder=sharer,
        defaults={
            "coupon_detail": template.coupon_detail,
            "important_notes": template.important_notes,
            "start_date": now - timedelta(days=1),
            "expiry_date": now + timedelta(days=30),
            "image_url": template.image_url,
            "coupon_type": "exclusive",
            "estimated_savings": template.estimated_savings,
            "original_owner": sharer,
            "last_holder": None,
            "acquisition_method": "transfer",
        },
    )
    return coupon


def upsert_share_request(coupon: Coupon, sharer: User) -> CouponShareRequest:
    share, _ = CouponShareRequest.objects.update_or_create(
        token=FIXTURE["share_token"],
        defaults={
            "coupon": coupon,
            "from_user": sharer,
            "to_user": None,
            "status": "pending",
            "is_public": False,
        },
    )
    return share


def seed_points_history(template: CouponTemplate) -> None:
    # Seed two historical web redemptions linked to same phone number.
    for token in ["web-journey-old-redemption-0001", "web-journey-old-redemption-0002"]:
        WebRedemption.objects.get_or_create(
            session_token=token,
            defaults={
                "template": template,
                "phone_number": FIXTURE["points_phone"],
            },
        )


def main() -> None:
    merchant, sharer = upsert_users()
    store = upsert_store(merchant)
    template = upsert_template(store)
    session = upsert_qr_session(template, merchant)
    share_coupon = upsert_share_coupon(template, store, sharer)
    share = upsert_share_request(share_coupon, sharer)
    seed_points_history(template)

    web_base = os.getenv("WEB_BASE_URL", "http://localhost:3000").rstrip("/")
    api_base = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

    print("=" * 72)
    print("Web user journey fixtures are ready.")
    print("=" * 72)
    print(f"Store ID:         {store.id}")
    print(f"Template ID:      {template.id}")
    print(f"Session token:    {session.session_token}")
    print(f"Share token:      {share.token}")
    print(f"Points phone:     {FIXTURE['points_phone']} (pre-seeded 2 points)")
    print("-" * 72)
    print("Direct web routes:")
    print(f"1) Claim entry:   {web_base}/w/claim/{session.session_token}")
    print(f"2) Share entry:   {web_base}/w/share/{share.token}")
    print(f"3) Merchant page: {web_base}/w/merchant/{store.id}?session={session.session_token}")
    print(f"4) Coupon page:   {web_base}/w/coupon/{template.id}?session={session.session_token}")
    print("-" * 72)
    print("Backend fallback routes (redirect to /w/* when feature flag enabled):")
    print(f"5) Claim fallback: {api_base}/claim/{session.session_token}/")
    print(f"6) Share fallback: {api_base}/collection/{share.token}/")
    print("=" * 72)
    print("Suggested test:")
    print("- Open #1, proceed to scanner and redeem.")
    print(f"- On points page enter: {FIXTURE['points_phone']}")
    print("- You should hit threshold_reached = true after this redemption.")


if __name__ == "__main__":
    main()
