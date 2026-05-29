"""
Seed the dev DB with stores, coupons, shares, store news, and QR sessions.

Idempotent — re-runs cleanly. Builds the data around the default mobile-map
centre (25.0478, 121.5318 — Taipei east district) so /api/merchants/nearby/
returns a useful mix at the default 2km radius.

Run from Backend/:
    python manage.py shell < seed_dev_data.py
or:
    python seed_dev_data.py        # standalone (configures Django first)
"""

from __future__ import annotations

import os
import sys

# Standalone bootstrap so this works as `python seed_dev_data.py` too.
if not os.environ.get('DJANGO_SETTINGS_MODULE'):
    os.environ['DJANGO_SETTINGS_MODULE'] = 'Backend.settings'
    import django  # noqa: E402
    django.setup()

from datetime import timedelta  # noqa: E402

from django.contrib.auth.models import Group, User  # noqa: E402
from django.utils import timezone  # noqa: E402

from api.models import (  # noqa: E402
    Coupon,
    CouponShareRequest,
    CouponTemplate,
    MerchantProfile,
    QRCodeSession,
    Store,
    StoreFixedSession,
    StoreNews,
    StudentProfile,
)
from api.spinner_coop.wallet_service import WalletService  # noqa: E402


def line(msg: str) -> None:
    print(f"[seed] {msg}")


# ── Merchant accounts + stores ───────────────────────────────────────────────

# (username, store_name, address, lat, lng, store_type)
MERCHANTS = [
    ('demo_amin',     '阿明早餐店', '忠孝東路 3 段',    25.0478, 121.5318, 'restaurant'),
    ('demo_dintai',   '鼎泰豐',    '信義路 2 段',      25.0490, 121.5340, 'restaurant'),
    ('demo_85c',      '85度C',     '復興南路 1 段',    25.0460, 121.5302, 'restaurant'),
    ('demo_pxmart',   '全聯福利中心', '中山北路 2 段',  25.0452, 121.5358, 'retail'),
    ('demo_seven',    '7-Eleven',  '南京東路 4 段',    25.0485, 121.5295, 'retail'),
    ('demo_familymt', '全家便利商店', '南京東路 5 段',  25.0468, 121.5375, 'retail'),
]

# (template_name, detail, savings, qty, redeem_code)
TEMPLATES_PER_STORE = [
    ('現金折抵 $25',   '$25 現金折抵',     25, 50, '111111'),
    ('現金折抵 $50',   '$50 現金折抵',     50, 30, '222222'),
    ('買一送一咖啡',    '美式咖啡 買一送一', 35, 40, '333333'),
]

NEWS_PER_STORE = [
    '今天有新品 — 起司蛋餅試賣中, 歡迎大家來吃看看',
    '本週末延長營業至晚上 10 點',
    '線上點餐滿 $200 折 $20',
]


merchant_group, _ = Group.objects.get_or_create(name='Merchant')
now = timezone.now()
start = now - timedelta(days=1)
expiry = now + timedelta(days=30)

stores: dict[str, Store] = {}
for username, name, addr, lat, lng, kind in MERCHANTS:
    user, created = User.objects.get_or_create(
        username=username,
        defaults={'email': f'{username}@example.com'},
    )
    if created:
        user.set_password('demo_pw')
        user.save()
    user.groups.add(merchant_group)
    MerchantProfile.objects.get_or_create(
        user=user,
        defaults={'phone': '0900000000', 'contact_info': 'line:demo'},
    )

    store, _ = Store.objects.get_or_create(
        owner=user,
        defaults={
            'name': name,
            'address': addr,
            'lat': lat,
            'lng': lng,
            'store_type': kind,
            'accepts_platform_vouchers': True,
        },
    )
    # Re-sync mutable fields in case we changed them between runs.
    store.name = name
    store.address = addr
    store.lat = lat
    store.lng = lng
    store.store_type = kind
    store.save()
    stores[username] = store
    line(f'store ok  → {name} ({lat}, {lng})')


# ── Templates per store ──────────────────────────────────────────────────────

template_index: dict[tuple[int, str], CouponTemplate] = {}
for store in stores.values():
    for tpl_name, detail, savings, qty, code in TEMPLATES_PER_STORE:
        tpl, created = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name=tpl_name,
            defaults={
                'coupon_detail': detail,
                'estimated_savings': savings,
                'total_quantity': qty,
                'remaining_quantity': qty,
                'start_date': start,
                'expiry_date': expiry,
                'template_redeem_code': code,
                'draw_probability': 0.6,
                'is_active': True,
            },
        )
        template_index[(store.id, tpl_name)] = tpl
line(f'templates: {len(template_index)}')


# ── Consumer accounts ───────────────────────────────────────────────────────

# Primary smoke-test user (already created in earlier session, idempotent here)
smoketest, _ = User.objects.get_or_create(
    username='smoketest',
    defaults={'email': 'smoke@example.com'},
)
smoketest.set_password('hunter2')
smoketest.save()
sp, _ = StudentProfile.objects.get_or_create(user=smoketest)
sp.verified = True
sp.phone_verified = True
sp.save()
WalletService.ensure_wallet(smoketest.id, initial_gems=3)

# Second consumer used as the public-share *sharer*
sharer, _ = User.objects.get_or_create(
    username='demo_sharer',
    defaults={'email': 'sharer@example.com', 'first_name': '小明'},
)
sharer.set_password('hunter2')
sharer.save()
sp2, _ = StudentProfile.objects.get_or_create(user=sharer)
sp2.verified = True
sp2.phone_verified = True
sp2.save()
WalletService.ensure_wallet(sharer.id, initial_gems=3)

line(f'consumers ok → smoketest (#{smoketest.id}), demo_sharer (#{sharer.id})')


# ── Coupons owned by smoketest (active inventory for HomeScreen) ────────────

OWNED = [
    ('demo_amin',     '現金折抵 $25', 25, 'ABCD25'),
    ('demo_amin',     '買一送一咖啡',  0,  'BOGOFC'),
    ('demo_dintai',   '現金折抵 $50', 50, 'XLB050'),
    ('demo_pxmart',   '現金折抵 $25', 25, 'PX0025'),
    ('demo_85c',      '現金折抵 $25', 25, 'C85025'),
]
for username, tpl_name, savings, code in OWNED:
    store = stores[username]
    tpl = template_index[(store.id, tpl_name)]
    # use a stable redeem_code + name combo as the idempotency key
    Coupon.objects.get_or_create(
        store=store,
        coupon_name=tpl_name,
        current_holder=smoketest,
        redeem_code=code,
        defaults={
            'template': tpl,
            'coupon_detail': tpl.coupon_detail,
            'start_date': start,
            'expiry_date': expiry,
            'coupon_type': 'exclusive',
            'estimated_savings': savings,
            'original_owner': smoketest,
            'acquisition_method': 'draw',
        },
    )
line(f"smoketest holds {Coupon.objects.filter(current_holder=smoketest).count()} coupons")


# ── Public-pool shares from demo_sharer (CouMap shared coupons) ─────────────

SHARED = [
    ('demo_amin',     '現金折抵 $25', 25, 'SAM01'),
    ('demo_amin',     '買一送一咖啡',  0,  'SAM02'),
    ('demo_dintai',   '現金折抵 $50', 50, 'SDT01'),
    ('demo_familymt', '現金折抵 $25', 25, 'SFM01'),
]
import secrets  # noqa: E402

for username, tpl_name, savings, code in SHARED:
    store = stores[username]
    tpl = template_index[(store.id, tpl_name)]
    coupon, _ = Coupon.objects.get_or_create(
        store=store,
        coupon_name=tpl_name,
        original_owner=sharer,
        redeem_code=code,
        defaults={
            'template': tpl,
            'coupon_detail': tpl.coupon_detail,
            'start_date': start,
            'expiry_date': expiry,
            'coupon_type': 'exclusive',
            'estimated_savings': savings,
            'current_holder': None,  # public-pool: no holder until claimed
            'acquisition_method': 'draw',
        },
    )
    # ensure there's exactly one pending public share per coupon
    if not CouponShareRequest.objects.filter(
        coupon=coupon, is_public=True, status='pending'
    ).exists():
        CouponShareRequest.objects.create(
            coupon=coupon,
            from_user=sharer,
            token=secrets.token_urlsafe(24),
            status='pending',
            is_public=True,
        )
line(f"public-pool shares: {CouponShareRequest.objects.filter(is_public=True, status='pending').count()}")


# ── StoreNews for each store ────────────────────────────────────────────────

for store, body in zip(stores.values(), NEWS_PER_STORE):
    if not StoreNews.objects.filter(store=store).exists():
        StoreNews.objects.create(store=store, body=body)
line(f"news rows: {StoreNews.objects.count()}")


# ── QR sessions for the receive flow + StoreFixedSession for CouPoint use ──

amin = stores['demo_amin']
sample_tpl = template_index[(amin.id, '現金折抵 $25')]
qr_session, _ = QRCodeSession.objects.get_or_create(
    session_token='demo-qr-token-amin-25',
    defaults={'template': sample_tpl, 'merchant': amin.owner, 'is_active': True},
)
StoreFixedSession.objects.get_or_create(
    store=amin,
    defaults={'session_token': 'demo-fixed-amin', 'is_active': True},
)
line(f"qr session token: {qr_session.session_token}")
line(f"fixed session token: demo-fixed-amin (for /api/coupoints/use/)")

print()
print('─' * 64)
print(f'  Seeded {len(stores)} stores · {len(template_index)} templates')
print(f'  smoketest owns {Coupon.objects.filter(current_holder=smoketest).count()} coupons')
print(f'  {CouponShareRequest.objects.filter(is_public=True, status="pending").count()} public-pool shares')
print()
print('  Login (consumer): smoke@example.com / hunter2')
print('  Sharer account:   demo_sharer (sharer@example.com / hunter2)')
print()
print('  QR tokens for testing:')
print('    /coupon/receive/ → demo-qr-token-amin-25')
print('    /coupoints/use/  → demo-fixed-amin')
print('─' * 64)
