"""GET /api/coupons/ — Phase 3 my-coupons list + alias routes.

Covers:
  * auth required
  * returns only current_holder=user, exclusive type
  * FE projection: string id, MM/DD expires, integer amount, derived status
  * status='redeemed' when CouponRedemption exists
  * status='shared' when a pending CouponShareRequest exists
  * empty list for users with no held coupons
  * alias route /api/coupons/<id>/redeem/ still hits redeem_coupon
  * alias route /api/coupons/<id>/share/ still hits share_coupon
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    Coupon,
    CouponRedemption,
    CouponShareRequest,
    Store,
)


pytestmark = pytest.mark.django_db


@pytest.fixture
def consumer():
    return User.objects.create_user(username="lister", password="x")


@pytest.fixture
def client(consumer):
    c = APIClient()
    c.force_authenticate(user=consumer)
    return c


@pytest.fixture
def store():
    merchant_group, _ = Group.objects.get_or_create(name='Merchant')
    merchant = User.objects.create_user(username="m_lister", password="x")
    merchant.groups.add(merchant_group)
    return Store.objects.create(owner=merchant, name="阿明早餐店", address="忠孝東路")


def _make_coupon(store, holder, *, amount=25, expires_in_days=14):
    return Coupon.objects.create(
        store=store,
        coupon_name="優惠",
        coupon_detail="$25 現金折抵",
        start_date=timezone.now() - timedelta(days=1),
        expiry_date=timezone.now() + timedelta(days=expires_in_days),
        coupon_type='exclusive',
        estimated_savings=amount,
        original_owner=holder,
        current_holder=holder,
        redeem_code='ABC123',
    )


# ── auth ─────────────────────────────────────────────────────────────────────


def test_requires_auth():
    resp = APIClient().get("/api/coupons/")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ── empty + projection ───────────────────────────────────────────────────────


def test_empty_when_no_coupons(client):
    resp = client.get("/api/coupons/")
    assert resp.status_code == 200
    assert resp.json() == []


def test_returns_only_users_own_coupons(client, consumer, store):
    other = User.objects.create_user(username="other", password="x")
    _make_coupon(store, holder=consumer, amount=25)
    _make_coupon(store, holder=other, amount=50)
    body = client.get("/api/coupons/").json()
    assert len(body) == 1
    assert body[0]["amount"] == 25


def test_excludes_store_type_coupons(client, consumer, store):
    # An old-style store-type coupon shouldn't appear (no holder concept).
    Coupon.objects.create(
        store=store,
        coupon_name="store coup",
        coupon_detail="anytime",
        start_date=timezone.now() - timedelta(days=1),
        expiry_date=timezone.now() + timedelta(days=10),
        coupon_type='store',  # legacy type — deprecated
        estimated_savings=10,
    )
    _make_coupon(store, holder=consumer, amount=5)
    body = client.get("/api/coupons/").json()
    assert len(body) == 1
    assert body[0]["amount"] == 5


def test_projection_shape(client, consumer, store):
    coupon = _make_coupon(store, holder=consumer, amount=25)
    body = client.get("/api/coupons/").json()
    row = body[0]
    assert set(row.keys()) == {"id", "store", "detail", "expires", "amount", "status"}
    assert row["id"] == str(coupon.id)
    assert row["store"] == "阿明早餐店"
    assert row["detail"] == "$25 現金折抵"
    assert row["amount"] == 25
    # MM/DD format
    assert len(row["expires"]) == 5 and row["expires"][2] == "/"
    assert row["status"] == "active"


# ── status derivation ────────────────────────────────────────────────────────


def test_status_redeemed_when_redemption_exists(client, consumer, store):
    coupon = _make_coupon(store, holder=consumer, amount=5)
    CouponRedemption.objects.create(coupon=coupon, user=consumer, savings_amount=5)
    body = client.get("/api/coupons/").json()
    assert body[0]["status"] == "redeemed"


def test_status_shared_when_pending_share(client, consumer, store):
    coupon = _make_coupon(store, holder=consumer, amount=5)
    CouponShareRequest.objects.create(
        coupon=coupon, from_user=consumer, token='tok1', status='pending'
    )
    body = client.get("/api/coupons/").json()
    assert body[0]["status"] == "shared"


def test_status_expired_when_past_expiry(client, consumer, store):
    coupon = _make_coupon(store, holder=consumer, amount=5, expires_in_days=-1)
    body = client.get("/api/coupons/").json()
    assert body[0]["status"] == "expired"


def test_zero_amount_when_no_estimated_savings(client, consumer, store):
    Coupon.objects.create(
        store=store,
        coupon_name="no savings",
        coupon_detail="d",
        start_date=timezone.now() - timedelta(days=1),
        expiry_date=timezone.now() + timedelta(days=10),
        coupon_type='exclusive',
        current_holder=consumer,
    )
    body = client.get("/api/coupons/").json()
    assert body[0]["amount"] == 0


# ── aliases hit the same view machinery as the originals ─────────────────────


def test_alias_redeem_route_routes_correctly(client, consumer, store):
    coupon = _make_coupon(store, holder=consumer)
    # No body — original path requires redeem_code. Both routes should 400.
    resp = client.post(f"/api/coupons/{coupon.id}/redeem/", {}, format="json")
    assert resp.status_code == 400  # CouProAPIException (RedeemCodeInvalid)


def test_alias_share_route_routes_correctly(client, consumer, store):
    coupon = _make_coupon(store, holder=consumer)
    # share_coupon requires authed user is the current_holder — should accept this call shape.
    resp = client.post(f"/api/coupons/{coupon.id}/share/", {}, format="json")
    # Whatever the original endpoint returns (200/400/etc), the route must
    # NOT 404 — that's the entire point of the alias.
    assert resp.status_code != 404
