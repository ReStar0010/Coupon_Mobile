"""Phase 4 — merchant discovery + sheet + StoreNews + flag/block aliases.

Covers:
  * GET /api/merchants/nearby/ — bbox + Haversine + blocked exclusion
  * GET /api/merchants/<id>/   — Merchant + myCoupons + sharedCoupons + news
  * Block/unblock alias routing at /api/merchants/<id>/block/
  * Flag alias forwards to ReportContentView
  * Merchant news CRUD scoped to merchant.owned_store
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    BlockedMerchant,
    Coupon,
    CouponShareRequest,
    Store,
    StoreNews,
)


pytestmark = pytest.mark.django_db


@pytest.fixture
def merchant_group():
    grp, _ = Group.objects.get_or_create(name='Merchant')
    return grp


@pytest.fixture
def merchant(merchant_group):
    u = User.objects.create_user(username="m_phase4", password="x")
    u.groups.add(merchant_group)
    return u


@pytest.fixture
def store(merchant):
    return Store.objects.create(
        owner=merchant,
        name="阿明早餐店",
        lat=25.0478,
        lng=121.5318,
        address="忠孝東路",
        store_type='restaurant',
    )


@pytest.fixture
def far_store(merchant_group):
    other_merchant = User.objects.create_user(username="m_far", password="x")
    other_merchant.groups.add(merchant_group)
    return Store.objects.create(
        owner=other_merchant,
        name="遠的店",
        lat=24.0,
        lng=120.0,  # ~115 km away
        address="far",
        store_type='retail',
    )


@pytest.fixture
def consumer():
    return User.objects.create_user(username="c_phase4", password="x")


@pytest.fixture
def client(consumer):
    c = APIClient()
    c.force_authenticate(user=consumer)
    return c


@pytest.fixture
def merchant_client(merchant):
    c = APIClient()
    c.force_authenticate(user=merchant)
    return c


# ── /api/merchants/nearby/ ────────────────────────────────────────────────────


class TestNearby:
    def test_requires_auth(self):
        resp = APIClient().get("/api/merchants/nearby/?lat=25&lng=121")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_params_400(self, client):
        resp = client.get("/api/merchants/nearby/")
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "MERCHANT_NEARBY_PARAMS_INVALID"

    def test_includes_store_within_radius(self, client, store):
        resp = client.get(f"/api/merchants/nearby/?lat={store.lat}&lng={store.lng}&radius=1")
        assert resp.status_code == 200
        body = resp.json()
        assert any(s["name"] == "阿明早餐店" for s in body)
        # distanceKm is added
        assert all("distanceKm" in s for s in body)

    def test_excludes_far_stores(self, client, store, far_store):
        resp = client.get(f"/api/merchants/nearby/?lat={store.lat}&lng={store.lng}&radius=1")
        names = [s["name"] for s in resp.json()]
        assert "阿明早餐店" in names
        assert "遠的店" not in names

    def test_excludes_blocked(self, client, consumer, store):
        BlockedMerchant.objects.create(user=consumer, store=store)
        resp = client.get(f"/api/merchants/nearby/?lat={store.lat}&lng={store.lng}&radius=1")
        assert all(s["id"] != str(store.id) for s in resp.json())

    def test_radius_clamped_above_max(self, client, store, far_store):
        # Even with absurd radius we shouldn't crash; we'd include far store
        # since 10km MAX is the upper clamp.
        resp = client.get(f"/api/merchants/nearby/?lat={store.lat}&lng={store.lng}&radius=99999")
        assert resp.status_code == 200


# ── /api/merchants/<id>/ ──────────────────────────────────────────────────────


class TestMerchantDetail:
    def test_requires_auth(self, store):
        resp = APIClient().get(f"/api/merchants/{store.id}/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_404_when_missing(self, client):
        resp = client.get("/api/merchants/99999/")
        assert resp.status_code == 404

    def test_returns_sheet_shape(self, client, consumer, store):
        # owned exclusive coupon at this store
        coupon = Coupon.objects.create(
            store=store,
            coupon_name="my coup",
            coupon_detail="$25 off",
            start_date=timezone.now() - timedelta(days=1),
            expiry_date=timezone.now() + timedelta(days=5),
            coupon_type='exclusive',
            estimated_savings=25,
            original_owner=consumer,
            current_holder=consumer,
        )
        # public-pool share from another user at the same store
        other = User.objects.create_user(username="sharer4", password="x")
        shared = Coupon.objects.create(
            store=store,
            coupon_name="shared coup",
            coupon_detail="$10 off",
            start_date=timezone.now() - timedelta(days=1),
            expiry_date=timezone.now() + timedelta(days=5),
            coupon_type='exclusive',
            estimated_savings=10,
            original_owner=other,
            current_holder=None,
        )
        CouponShareRequest.objects.create(
            coupon=shared, from_user=other, token='t-shared', is_public=True, status='pending'
        )
        # news
        StoreNews.objects.create(store=store, body="新品試賣中")

        resp = client.get(f"/api/merchants/{store.id}/")
        body = resp.json()
        assert resp.status_code == 200
        assert body["name"] == "阿明早餐店"
        assert len(body["myCoupons"]) == 1
        assert body["myCoupons"][0]["amount"] == 25
        assert len(body["sharedCoupons"]) == 1
        assert body["sharedCoupons"][0]["amount"] == 10
        assert len(body["news"]) == 1
        assert body["news"][0]["body"] == "新品試賣中"


# ── /api/merchants/blocked/ ──────────────────────────────────────────────────


def test_blocked_list_returns_flat_merchants(client, consumer, store):
    BlockedMerchant.objects.create(user=consumer, store=store)
    resp = client.get("/api/merchants/blocked/")
    body = resp.json()
    assert len(body) == 1
    assert body[0]["id"] == str(store.id)
    assert body[0]["name"] == "阿明早餐店"


# ── /api/merchants/<id>/block/ + unblock ──────────────────────────────────────


def test_block_unblock_at_alias(client, consumer, store):
    # POST → block
    r1 = client.post(f"/api/merchants/{store.id}/block/", {}, format="json")
    assert r1.status_code in (200, 201)
    assert BlockedMerchant.objects.filter(user=consumer, store=store).exists()
    # DELETE → unblock
    r2 = client.delete(f"/api/merchants/{store.id}/block/")
    assert r2.status_code in (200, 204)
    assert not BlockedMerchant.objects.filter(user=consumer, store=store).exists()


# ── /api/merchants/<id>/flag/ ────────────────────────────────────────────────


def test_flag_creates_content_report(client, store):
    resp = client.post(
        f"/api/merchants/{store.id}/flag/",
        {"reason": "inappropriate", "details": "test"},
        format="json",
    )
    assert resp.status_code in (200, 201)


# ── /api/merchant/news/ — merchant CRUD ──────────────────────────────────────


class TestMerchantNews:
    def test_consumer_cannot_post_news(self, client):
        resp = client.post("/api/merchant/news/", {"body": "hi"}, format="json")
        assert resp.status_code == 400  # NoStoreForMerchant
        assert resp.json()["error_code"] == "NO_STORE_FOR_MERCHANT"

    def test_merchant_create_lists_news(self, merchant_client, store):
        resp = merchant_client.post("/api/merchant/news/", {"body": "新品試賣中"}, format="json")
        assert resp.status_code == 201
        body = resp.json()
        assert body["body"] == "新品試賣中"
        assert body["author"] == store.name
        # Now list
        list_resp = merchant_client.get("/api/merchant/news/")
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 1

    def test_merchant_create_validation(self, merchant_client, store):
        # empty
        r1 = merchant_client.post("/api/merchant/news/", {"body": ""}, format="json")
        assert r1.status_code == 400
        # too long
        r2 = merchant_client.post(
            "/api/merchant/news/", {"body": "x" * 201}, format="json"
        )
        assert r2.status_code == 400

    def test_merchant_delete_own_news(self, merchant_client, store):
        row = StoreNews.objects.create(store=store, body="to delete")
        resp = merchant_client.delete(f"/api/merchant/news/{row.id}/")
        assert resp.status_code == 204
        assert not StoreNews.objects.filter(id=row.id).exists()

    def test_merchant_cannot_delete_other_merchants_news(
        self, merchant_client, merchant_group, store
    ):
        other_merchant = User.objects.create_user(username="m_other_news", password="x")
        other_merchant.groups.add(merchant_group)
        other_store = Store.objects.create(
            owner=other_merchant, name="他的店", address="x"
        )
        row = StoreNews.objects.create(store=other_store, body="not mine")
        resp = merchant_client.delete(f"/api/merchant/news/{row.id}/")
        assert resp.status_code == 404
        assert StoreNews.objects.filter(id=row.id).exists()
