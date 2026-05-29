"""Phase 8 — wallet transaction history endpoints.

Covers:
  * GET /api/wallet/transactions/ — auth required, empty list, type filter
    buckets, pagination with limit + cursor.
  * GET /api/wallet/transactions/<id>/ — 404 for foreign user, coupon
    reference present when related_coupon_id is set.

These endpoints are read-only projections over the WalletTransaction ledger;
mutation paths are exercised by the wallet_service tests already in place.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Coupon, Store
from api.spinner_coop.models import Wallet, WalletTransaction


pytestmark = pytest.mark.django_db


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def consumer():
    user = User.objects.create_user(username="tx_consumer", password="x")
    Wallet.objects.create(user=user, gems=0, cou_points=0)
    return user


@pytest.fixture
def other_consumer():
    user = User.objects.create_user(username="tx_other", password="x")
    Wallet.objects.create(user=user, gems=0, cou_points=0)
    return user


@pytest.fixture
def client(consumer):
    c = APIClient()
    c.force_authenticate(user=consumer)
    return c


@pytest.fixture
def store():
    return Store.objects.create(name="阿明早餐店", address="台北市中正區")


def _make_tx(
    *,
    user: User,
    kind: str,
    delta_gems: int = 0,
    delta_cou_points: int = 0,
    related_coupon_id: int | None = None,
    related_store_id: int | None = None,
    note: str = "",
) -> WalletTransaction:
    """Create a WalletTransaction row directly (bypass WalletService) to keep
    the test focused on the read path.

    The balance_after_* fields are filled with the resulting wallet balances
    so the snapshot stays consistent — but the wallet itself is not mutated
    here, since these tests only exercise the read endpoints.
    """
    return WalletTransaction.objects.create(
        user=user,
        kind=kind,
        delta_gems=delta_gems,
        delta_cou_points=delta_cou_points,
        balance_after_gems=max(0, delta_gems),
        balance_after_cou_points=max(0, delta_cou_points),
        related_coupon_id=related_coupon_id,
        related_store_id=related_store_id,
        note=note,
    )


# ── List endpoint ─────────────────────────────────────────────────────────────


class TestListAuthorization:
    def test_requires_authentication(self):
        unauth = APIClient()
        resp = unauth.get("/api/wallet/transactions/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestListEmpty:
    def test_empty_when_no_transactions(self, client):
        resp = client.get("/api/wallet/transactions/")
        assert resp.status_code == 200
        body = resp.json()
        assert body == {"items": [], "nextCursor": None}


class TestListShape:
    def test_includes_store_name_for_coupon_redeem(self, client, consumer, store):
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.COUPON_REDEEM,
            delta_gems=-25,
            related_store_id=store.id,
            note="$25 折抵 — 阿明早餐店",
        )
        resp = client.get("/api/wallet/transactions/")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        row = items[0]
        assert row["type"] == "coupon"
        assert row["store"] == "阿明早餐店"
        assert row["amount"] == 25
        assert row["balanceAfterGems"] == 0
        assert row["kind"] == WalletTransaction.Kind.COUPON_REDEEM
        # usedAt is formatted YYYY-MM-DD HH:MM
        assert len(row["usedAt"]) == 16

    def test_coupoint_amount_uses_cou_point_delta(self, client, consumer):
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.COUPOINT_SPEND,
            delta_cou_points=-15,
        )
        resp = client.get("/api/wallet/transactions/")
        row = resp.json()["items"][0]
        assert row["type"] == "coupoint"
        assert row["amount"] == 15

    def test_store_is_null_when_unrelated(self, client, consumer):
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SPINNER_SOLO,
            delta_cou_points=+5,
        )
        row = client.get("/api/wallet/transactions/").json()["items"][0]
        assert row["store"] is None


class TestListTypeFilter:
    @pytest.fixture(autouse=True)
    def _seed(self, consumer, store):
        # Coupon-bucket rows
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.COUPON_REDEEM,
            delta_gems=-10,
            related_store_id=store.id,
        )
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SHARE_REWARD,
            delta_gems=+1,
        )
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.QR_CLAIM,
            delta_gems=+5,
        )
        # CouPoint-bucket rows
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SPINNER_SOLO,
            delta_cou_points=+5,
        )
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SPINNER_COOP,
            delta_cou_points=+12,
        )
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.COUPOINT_SPEND,
            delta_cou_points=-20,
        )
        # Seed row — neither bucket
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SEED,
            delta_gems=+3,
        )

    def test_all_returns_every_row(self, client):
        items = client.get("/api/wallet/transactions/?type=all").json()["items"]
        assert len(items) == 7

    def test_coupon_bucket(self, client):
        items = client.get("/api/wallet/transactions/?type=coupon").json()["items"]
        kinds = {row["kind"] for row in items}
        assert kinds == {
            WalletTransaction.Kind.COUPON_REDEEM,
            WalletTransaction.Kind.SHARE_REWARD,
            WalletTransaction.Kind.QR_CLAIM,
        }
        assert all(row["type"] == "coupon" for row in items)

    def test_coupoint_bucket(self, client):
        items = client.get("/api/wallet/transactions/?type=coupoint").json()["items"]
        kinds = {row["kind"] for row in items}
        assert kinds == {
            WalletTransaction.Kind.SPINNER_SOLO,
            WalletTransaction.Kind.SPINNER_COOP,
            WalletTransaction.Kind.COUPOINT_SPEND,
        }
        assert all(row["type"] == "coupoint" for row in items)

    def test_invalid_type_rejects(self, client):
        resp = client.get("/api/wallet/transactions/?type=bogus")
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "INVALID_TRANSACTION_FILTER"


class TestListPagination:
    def test_limit_and_cursor(self, client, consumer):
        # Seed 30 rows, oldest first so the newest IDs are the highest.
        for i in range(30):
            _make_tx(
                user=consumer,
                kind=WalletTransaction.Kind.SHARE_REWARD,
                delta_gems=+1,
                note=f"row-{i}",
            )

        first = client.get("/api/wallet/transactions/?limit=10").json()
        assert len(first["items"]) == 10
        assert first["nextCursor"] is not None

        # Page 2 uses the last cursor from page 1.
        cursor1 = first["nextCursor"]
        second = client.get(f"/api/wallet/transactions/?limit=10&cursor={cursor1}").json()
        assert len(second["items"]) == 10
        assert second["nextCursor"] is not None

        # Page 3 is the final 10 rows; nextCursor must be null.
        cursor2 = second["nextCursor"]
        third = client.get(f"/api/wallet/transactions/?limit=10&cursor={cursor2}").json()
        assert len(third["items"]) == 10
        assert third["nextCursor"] is None

        # Page 4 (past the end) is empty.
        empty = client.get(
            f"/api/wallet/transactions/?limit=10&cursor={third['items'][-1]['id']}"
        ).json()
        assert empty == {"items": [], "nextCursor": None}

        # Pages don't overlap and the union recovers every row.
        all_ids = (
            [r["id"] for r in first["items"]]
            + [r["id"] for r in second["items"]]
            + [r["id"] for r in third["items"]]
        )
        assert len(all_ids) == len(set(all_ids)) == 30

    def test_limit_caps_at_max(self, client, consumer):
        for _ in range(5):
            _make_tx(
                user=consumer,
                kind=WalletTransaction.Kind.SHARE_REWARD,
                delta_gems=+1,
            )
        resp = client.get("/api/wallet/transactions/?limit=10000")
        # Doesn't 400 — silently caps at MAX_TX_LIMIT (100).
        assert resp.status_code == 200

    def test_invalid_limit_rejects(self, client):
        resp = client.get("/api/wallet/transactions/?limit=abc")
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "INVALID_TRANSACTION_FILTER"

    def test_zero_limit_rejects(self, client):
        resp = client.get("/api/wallet/transactions/?limit=0")
        assert resp.status_code == 400

    def test_orders_newest_first(self, client, consumer):
        first = _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SHARE_REWARD,
            delta_gems=+1,
        )
        second = _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SHARE_REWARD,
            delta_gems=+1,
        )
        items = client.get("/api/wallet/transactions/").json()["items"]
        assert [r["id"] for r in items] == [second.id, first.id]


class TestListIsolation:
    def test_does_not_leak_other_users_rows(self, client, consumer, other_consumer):
        _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SHARE_REWARD,
            delta_gems=+1,
            note='mine',
        )
        _make_tx(
            user=other_consumer,
            kind=WalletTransaction.Kind.SHARE_REWARD,
            delta_gems=+1,
            note='theirs',
        )
        items = client.get("/api/wallet/transactions/").json()["items"]
        assert len(items) == 1
        assert items[0]["detail"] == 'mine'


# ── Detail endpoint ───────────────────────────────────────────────────────────


class TestDetail:
    def test_requires_authentication(self, consumer):
        tx = _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SHARE_REWARD,
            delta_gems=+1,
        )
        unauth = APIClient()
        resp = unauth.get(f"/api/wallet/transactions/{tx.id}/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_row_for_owner(self, client, consumer, store):
        tx = _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.COUPON_REDEEM,
            delta_gems=-25,
            related_store_id=store.id,
            note="$25 折抵 — 阿明早餐店",
        )
        resp = client.get(f"/api/wallet/transactions/{tx.id}/")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == tx.id
        assert body["store"] == "阿明早餐店"
        assert body["amount"] == 25

    def test_returns_404_for_foreign_row(self, client, other_consumer):
        foreign_tx = _make_tx(
            user=other_consumer,
            kind=WalletTransaction.Kind.SHARE_REWARD,
            delta_gems=+1,
        )
        resp = client.get(f"/api/wallet/transactions/{foreign_tx.id}/")
        assert resp.status_code == 404
        assert resp.json()["error_code"] == "TRANSACTION_NOT_FOUND"

    def test_returns_404_for_missing_row(self, client):
        resp = client.get("/api/wallet/transactions/999999/")
        assert resp.status_code == 404

    def test_includes_coupon_reference_when_present(self, client, consumer, store):
        coupon = Coupon.objects.create(
            store=store,
            coupon_name="買一送一",
            coupon_detail="早餐 $25 折抵",
            start_date=timezone.now() - timedelta(days=1),
            expiry_date=timezone.now() + timedelta(days=7),
        )
        tx = _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.COUPON_REDEEM,
            delta_gems=-25,
            related_coupon_id=coupon.id,
            related_store_id=store.id,
        )
        body = client.get(f"/api/wallet/transactions/{tx.id}/").json()
        assert body["coupon"] == {"id": coupon.id, "name": "買一送一"}

    def test_omits_coupon_reference_when_absent(self, client, consumer):
        tx = _make_tx(
            user=consumer,
            kind=WalletTransaction.Kind.SPINNER_SOLO,
            delta_cou_points=+5,
        )
        body = client.get(f"/api/wallet/transactions/{tx.id}/").json()
        assert "coupon" not in body
