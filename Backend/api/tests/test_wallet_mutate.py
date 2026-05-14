"""WalletService.mutate + credit_gems + debit_cou_points + ledger invariants.

Phase 0 foundation tests. Verifies the single chokepoint for ledger-tracked
mutations behaves correctly under happy paths, failures, and rollback, and
that ledger rows always agree with the Wallet snapshot.
"""

from __future__ import annotations

import uuid

import pytest
from django.contrib.auth.models import User

from api.spinner_coop.models import Wallet, WalletTransaction
from api.spinner_coop.wallet_service import (
    InsufficientCouPointsError,
    InsufficientGemsError,
    WalletNotFoundError,
    WalletService,
)


pytestmark = pytest.mark.django_db


@pytest.fixture
def make_user():
    counter = {"n": 0}

    def _make(*, gems: int = 0, cou_points: int = 0, with_wallet: bool = True):
        counter["n"] += 1
        u = User.objects.create_user(username=f"mu{counter['n']}", password="x")
        if with_wallet:
            Wallet.objects.create(user=u, gems=gems, cou_points=cou_points)
        return u

    return _make


# ── ensure_wallet seed ────────────────────────────────────────────────────────


class TestEnsureWalletSeedsLedger:
    def test_seed_ledger_written_on_create(self):
        u = User.objects.create_user(username="seedy", password="x")
        WalletService.ensure_wallet(u.id, initial_gems=3)
        rows = WalletTransaction.objects.filter(user=u).order_by("created_at")
        assert rows.count() == 1
        row = rows.first()
        assert row.kind == WalletTransaction.Kind.SEED
        assert row.delta_gems == 3
        assert row.balance_after_gems == 3

    def test_no_ledger_when_initial_is_zero(self):
        u = User.objects.create_user(username="zero", password="x")
        WalletService.ensure_wallet(u.id, initial_gems=0)
        assert WalletTransaction.objects.filter(user=u).count() == 0

    def test_no_ledger_on_subsequent_calls(self, make_user):
        u = make_user(gems=7)
        WalletService.ensure_wallet(u.id, initial_gems=99)
        assert WalletTransaction.objects.filter(user=u).count() == 0

    def test_rejects_negative_initial(self):
        u = User.objects.create_user(username="neg", password="x")
        with pytest.raises(ValueError):
            WalletService.ensure_wallet(u.id, initial_gems=-1)

    def test_rejects_above_seed_ceiling(self):
        u = User.objects.create_user(username="huge", password="x")
        with pytest.raises(ValueError):
            WalletService.ensure_wallet(u.id, initial_gems=10_000)


# ── credit_gems ────────────────────────────────────────────────────────────────


class TestCreditGems:
    def test_happy_path(self, make_user):
        a = make_user(gems=2)
        b = make_user(gems=0)
        WalletService.credit_gems({a.id: 3, b.id: 5})
        assert Wallet.objects.get(user=a).gems == 5
        assert Wallet.objects.get(user=b).gems == 5

    def test_rejects_negative(self, make_user):
        a = make_user(gems=0)
        with pytest.raises(ValueError):
            WalletService.credit_gems({a.id: -1})

    def test_missing_wallet_raises(self, make_user):
        a = make_user(gems=0)
        missing_uid = a.id + 9999
        with pytest.raises(WalletNotFoundError):
            WalletService.credit_gems({missing_uid: 1})

    def test_empty_is_noop(self):
        WalletService.credit_gems({})


# ── debit_cou_points ───────────────────────────────────────────────────────────


class TestDebitCouPoints:
    def test_happy_path(self, make_user):
        a = make_user(cou_points=20)
        b = make_user(cou_points=10)
        WalletService.debit_cou_points({a.id: 5, b.id: 10})
        assert Wallet.objects.get(user=a).cou_points == 15
        assert Wallet.objects.get(user=b).cou_points == 0

    def test_atomic_rollback_on_insufficient(self, make_user):
        a = make_user(cou_points=20)
        b = make_user(cou_points=3)
        with pytest.raises(InsufficientCouPointsError):
            WalletService.debit_cou_points({a.id: 5, b.id: 10})
        assert Wallet.objects.get(user=a).cou_points == 20
        assert Wallet.objects.get(user=b).cou_points == 3

    def test_missing_wallet_raises(self, make_user):
        a = make_user(cou_points=5)
        with pytest.raises(WalletNotFoundError):
            WalletService.debit_cou_points({a.id: 1, a.id + 9999: 1})

    def test_rejects_negative(self, make_user):
        a = make_user(cou_points=5)
        with pytest.raises(ValueError):
            WalletService.debit_cou_points({a.id: -1})


# ── mutate ────────────────────────────────────────────────────────────────────


class TestMutate:
    def test_credit_gems_writes_ledger(self, make_user):
        a = make_user(gems=2)
        tx = WalletService.mutate(
            a.id,
            delta_gems=+1,
            kind=WalletTransaction.Kind.SHARE_REWARD,
            related_coupon_id=42,
            note="acceptor accepted my share",
        )
        assert Wallet.objects.get(user=a).gems == 3
        assert tx.delta_gems == 1
        assert tx.delta_cou_points == 0
        assert tx.balance_after_gems == 3
        assert tx.balance_after_cou_points == 0
        assert tx.related_coupon_id == 42

    def test_combined_debit_gems_credit_cou_points(self, make_user):
        a = make_user(gems=5, cou_points=10)
        tx = WalletService.mutate(
            a.id,
            delta_gems=-2,
            delta_cou_points=+6,
            kind=WalletTransaction.Kind.SPINNER_SOLO,
            note="x3 multiplier",
        )
        w = Wallet.objects.get(user=a)
        assert (w.gems, w.cou_points) == (3, 16)
        assert tx.balance_after_gems == 3
        assert tx.balance_after_cou_points == 16

    def test_insufficient_gems_rolls_back_entire_mutation(self, make_user):
        a = make_user(gems=1, cou_points=10)
        with pytest.raises(InsufficientGemsError):
            WalletService.mutate(
                a.id,
                delta_gems=-2,
                delta_cou_points=+99,  # would have been credited but rolls back
                kind=WalletTransaction.Kind.SPINNER_SOLO,
            )
        w = Wallet.objects.get(user=a)
        assert (w.gems, w.cou_points) == (1, 10)
        assert WalletTransaction.objects.filter(user=a).count() == 0

    def test_insufficient_cou_points_rolls_back(self, make_user):
        a = make_user(gems=5, cou_points=3)
        with pytest.raises(InsufficientCouPointsError):
            WalletService.mutate(
                a.id,
                delta_cou_points=-10,
                kind=WalletTransaction.Kind.COUPOINT_SPEND,
            )
        w = Wallet.objects.get(user=a)
        assert (w.gems, w.cou_points) == (5, 3)
        assert WalletTransaction.objects.filter(user=a).count() == 0

    def test_zero_zero_rejects(self, make_user):
        a = make_user(gems=5)
        with pytest.raises(ValueError):
            WalletService.mutate(
                a.id,
                delta_gems=0,
                delta_cou_points=0,
                kind=WalletTransaction.Kind.SPINNER_SOLO,
            )

    def test_no_wallet_raises(self):
        u = User.objects.create_user(username="nowallet", password="x")
        with pytest.raises(WalletNotFoundError):
            WalletService.mutate(
                u.id,
                delta_gems=+1,
                kind=WalletTransaction.Kind.SHARE_REWARD,
            )

    def test_accepts_string_user_id(self, make_user):
        a = make_user(gems=1)
        WalletService.mutate(
            str(a.id),
            delta_gems=+2,
            kind=WalletTransaction.Kind.SHARE_REWARD,
        )
        assert Wallet.objects.get(user=a).gems == 3

    def test_related_round_id_persists(self, make_user):
        a = make_user(gems=3)
        rid = uuid.uuid4()
        tx = WalletService.mutate(
            a.id,
            delta_gems=-1,
            delta_cou_points=+5,
            kind=WalletTransaction.Kind.SPINNER_COOP,
            related_round_id=rid,
        )
        assert tx.related_round_id == rid

    def test_version_bumps(self, make_user):
        a = make_user(gems=3)
        v0 = Wallet.objects.get(user=a).version
        WalletService.mutate(
            a.id, delta_gems=+1, kind=WalletTransaction.Kind.SHARE_REWARD
        )
        v1 = Wallet.objects.get(user=a).version
        assert v1 == v0 + 1

    def test_rejects_unknown_kind(self, make_user):
        a = make_user(gems=5)
        with pytest.raises(ValueError):
            WalletService.mutate(a.id, delta_gems=+1, kind="bogus")
        # Wallet untouched, no ledger row written
        assert Wallet.objects.get(user=a).gems == 5
        assert WalletTransaction.objects.filter(user=a).count() == 0

    def test_balance_after_uses_real_db_state(self, make_user):
        """The balance_after_* snapshot must match the post-update wallet,
        not Python arithmetic over a stale read."""
        a = make_user(gems=10, cou_points=20)
        tx = WalletService.mutate(
            a.id,
            delta_gems=-3,
            delta_cou_points=+5,
            kind=WalletTransaction.Kind.SPINNER_SOLO,
        )
        w = Wallet.objects.get(user=a)
        assert tx.balance_after_gems == w.gems == 7
        assert tx.balance_after_cou_points == w.cou_points == 25


# ── Ledger invariant: sum of deltas always equals current balance ─────────────


class TestLedgerInvariant:
    def test_sum_of_deltas_matches_balance(self, make_user):
        a = make_user(gems=0, cou_points=0)
        # First call ensure_wallet to seed a baseline transaction
        WalletService.ensure_wallet(a.id, initial_gems=0)  # no-op (already exists)

        # Apply a sequence of mutations
        WalletService.mutate(a.id, delta_gems=+5, kind=WalletTransaction.Kind.SEED)
        WalletService.mutate(a.id, delta_gems=-2, delta_cou_points=+10, kind=WalletTransaction.Kind.SPINNER_SOLO)
        WalletService.mutate(a.id, delta_gems=+1, kind=WalletTransaction.Kind.SHARE_REWARD)
        WalletService.mutate(a.id, delta_cou_points=-5, kind=WalletTransaction.Kind.COUPOINT_SPEND)

        w = Wallet.objects.get(user=a)
        rows = WalletTransaction.objects.filter(user=a)
        gem_sum = sum(r.delta_gems for r in rows)
        coupoint_sum = sum(r.delta_cou_points for r in rows)
        assert gem_sum == w.gems
        assert coupoint_sum == w.cou_points

    def test_balance_after_matches_chronologically(self, make_user):
        a = make_user(gems=0, cou_points=0)
        for _ in range(5):
            WalletService.mutate(
                a.id, delta_gems=+1, kind=WalletTransaction.Kind.SHARE_REWARD
            )
        # Order by id only — auto_now_add timestamps can collide on Postgres
        # under load. id is the only monotonic guarantee.
        rows = list(WalletTransaction.objects.filter(user=a).order_by("id"))
        running_g = 0
        running_p = 0
        for r in rows:
            running_g += r.delta_gems
            running_p += r.delta_cou_points
            assert r.balance_after_gems == running_g
            assert r.balance_after_cou_points == running_p
