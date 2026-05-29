"""POST /api/coupoints/use/ — server-authoritative CouPoint spend.

Covers:
  * auth required
  * missing / non-string qrToken → 400
  * invalid amount (non-int, ≤0, not multiple of 5) → 400
  * unknown / inactive qrToken → 404
  * insufficient balance → 400 with kind=INSUFFICIENT_COU_POINTS
  * happy path debits balance, returns store info, writes WalletTransaction
  * accepts both QRCodeSession.session_token and StoreFixedSession.session_token
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    CouponTemplate,
    QRCodeSession,
    Store,
    StoreFixedSession,
)
from api.spinner_coop.models import Wallet, WalletTransaction


pytestmark = pytest.mark.django_db


@pytest.fixture
def consumer():
    return User.objects.create_user(username="spender", password="x")


@pytest.fixture
def client(consumer):
    c = APIClient()
    c.force_authenticate(user=consumer)
    return c


@pytest.fixture
def store():
    merchant_group, _ = Group.objects.get_or_create(name='Merchant')
    merchant = User.objects.create_user(username="m", password="x")
    merchant.groups.add(merchant_group)
    return Store.objects.create(owner=merchant, name="阿明早餐店", address="忠孝東路")


@pytest.fixture
def template(store):
    return CouponTemplate.objects.create(
        store=store,
        coupon_name="test",
        coupon_detail="d",
        total_quantity=10,
        remaining_quantity=10,
        start_date=timezone.now() - timedelta(days=1),
        expiry_date=timezone.now() + timedelta(days=30),
    )


@pytest.fixture
def qr_session(template, store):
    merchant = store.owner
    return QRCodeSession.objects.create(
        template=template, merchant=merchant, session_token="tok-session-1", is_active=True
    )


@pytest.fixture
def fixed_session(store):
    return StoreFixedSession.objects.create(
        store=store, session_token="tok-fixed-1", is_active=True
    )


@pytest.fixture
def wallet(consumer):
    return Wallet.objects.create(user=consumer, gems=0, cou_points=100)


# ── auth + validation ────────────────────────────────────────────────────────


def test_requires_auth():
    resp = APIClient().post("/api/coupoints/use/", {}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_missing_qr_token_400(client, wallet):
    resp = client.post("/api/coupoints/use/", {"amount": 5}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "COUPOINT_QR_TOKEN_MISSING"


@pytest.mark.parametrize("amount", [0, -5, 3, 7, "5", 5.0])
def test_invalid_amount_400(client, wallet, fixed_session, amount):
    resp = client.post(
        "/api/coupoints/use/",
        {"qrToken": fixed_session.session_token, "amount": amount},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "COUPOINT_AMOUNT_INVALID"


def test_unknown_qr_token_404(client, wallet):
    resp = client.post(
        "/api/coupoints/use/",
        {"qrToken": "no-such-token", "amount": 5},
        format="json",
    )
    assert resp.status_code == 404
    assert resp.json()["error_code"] == "COUPOINT_QR_SESSION_NOT_FOUND"


def test_inactive_session_404(client, wallet, fixed_session):
    fixed_session.is_active = False
    fixed_session.save()
    resp = client.post(
        "/api/coupoints/use/",
        {"qrToken": fixed_session.session_token, "amount": 5},
        format="json",
    )
    assert resp.status_code == 404


# ── happy path ────────────────────────────────────────────────────────────────


def test_spend_fixed_session_happy(client, consumer, wallet, fixed_session, store):
    resp = client.post(
        "/api/coupoints/use/",
        {"qrToken": fixed_session.session_token, "amount": 25},
        format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["couPoints"] == 75
    assert body["amount"] == 25
    assert body["store"]["id"] == store.id
    assert body["store"]["name"] == "阿明早餐店"
    # Ledger
    tx = WalletTransaction.objects.get(id=body["transactionId"])
    assert tx.kind == WalletTransaction.Kind.COUPOINT_SPEND
    assert tx.delta_cou_points == -25
    assert tx.related_store_id == store.id


def test_spend_qr_session_resolves_to_template_store(
    client, consumer, wallet, qr_session, store
):
    resp = client.post(
        "/api/coupoints/use/",
        {"qrToken": qr_session.session_token, "amount": 10},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["store"]["id"] == store.id


def test_insufficient_balance_400(client, consumer, wallet, fixed_session):
    wallet.cou_points = 10
    wallet.save()
    resp = client.post(
        "/api/coupoints/use/",
        {"qrToken": fixed_session.session_token, "amount": 25},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "INSUFFICIENT_COU_POINTS"
    # Balance untouched
    wallet.refresh_from_db()
    assert wallet.cou_points == 10


def test_no_wallet_yet_lazily_seeded(client, consumer, fixed_session):
    # No Wallet row exists for this consumer
    assert not Wallet.objects.filter(user=consumer).exists()
    resp = client.post(
        "/api/coupoints/use/",
        {"qrToken": fixed_session.session_token, "amount": 5},
        format="json",
    )
    # Wallet seeded with 0 cou_points, so 5 spend fails with insufficient
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "INSUFFICIENT_COU_POINTS"
    assert Wallet.objects.filter(user=consumer).exists()
