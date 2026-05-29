"""WalletService unit tests — atomicity, invariants, error paths."""

from __future__ import annotations

import pytest
from django.contrib.auth.models import User

from api.spinner_coop.models import Wallet
from api.spinner_coop.wallet_service import (
    InsufficientGemsError,
    WalletNotFoundError,
    WalletService,
)


pytestmark = pytest.mark.django_db


@pytest.fixture
def make_user():
    counter = {"n": 0}

    def _make(*, gems: int = 0, cou_points: int = 0):
        counter["n"] += 1
        u = User.objects.create_user(
            username=f"u{counter['n']}", password="x"
        )
        Wallet.objects.create(user=u, gems=gems, cou_points=cou_points)
        return u

    return _make


class TestEnsureWallet:
    def test_creates_if_missing(self):
        u = User.objects.create_user(username="alice", password="x")
        assert not Wallet.objects.filter(user=u).exists()
        WalletService.ensure_wallet(u.id, initial_gems=5)
        w = Wallet.objects.get(user=u)
        assert w.gems == 5

    def test_idempotent_when_existing(self, make_user):
        u = make_user(gems=10)
        WalletService.ensure_wallet(u.id, initial_gems=99)
        # Existing balance preserved
        assert Wallet.objects.get(user=u).gems == 10


class TestDebitGems:
    def test_happy_path(self, make_user):
        a = make_user(gems=5)
        b = make_user(gems=3)
        WalletService.debit_gems({a.id: 3, b.id: 2})
        assert Wallet.objects.get(user=a).gems == 2
        assert Wallet.objects.get(user=b).gems == 1

    def test_atomic_rollback_on_insufficient(self, make_user):
        a = make_user(gems=5)
        b = make_user(gems=1)  # has only 1, can't afford 3
        with pytest.raises(InsufficientGemsError):
            WalletService.debit_gems({a.id: 3, b.id: 3})
        # a should NOT be debited because the whole tx rolled back
        assert Wallet.objects.get(user=a).gems == 5
        assert Wallet.objects.get(user=b).gems == 1

    def test_negative_amount_rejected(self, make_user):
        a = make_user(gems=5)
        with pytest.raises(ValueError):
            WalletService.debit_gems({a.id: -1})

    def test_unknown_user_raises(self):
        with pytest.raises(WalletNotFoundError):
            WalletService.debit_gems({99999: 1})

    def test_empty_debits_noop(self):
        WalletService.debit_gems({})

    def test_version_increments(self, make_user):
        a = make_user(gems=10)
        prior = Wallet.objects.get(user=a).version
        WalletService.debit_gems({a.id: 3})
        assert Wallet.objects.get(user=a).version == prior + 1


class TestRefundGems:
    def test_additive(self, make_user):
        a = make_user(gems=2)
        WalletService.refund_gems({a.id: 5})
        assert Wallet.objects.get(user=a).gems == 7

    def test_negative_rejected(self, make_user):
        a = make_user(gems=2)
        with pytest.raises(ValueError):
            WalletService.refund_gems({a.id: -1})


class TestCreditCouPoints:
    def test_additive(self, make_user):
        a = make_user(cou_points=10)
        WalletService.credit_coupoints({a.id: 7})
        assert Wallet.objects.get(user=a).cou_points == 17

    def test_negative_rejected(self, make_user):
        a = make_user()
        with pytest.raises(ValueError):
            WalletService.credit_coupoints({a.id: -1})


class TestGetBalance:
    def test_known_user(self, make_user):
        a = make_user(gems=4, cou_points=11)
        assert WalletService.get_balance(a.id) == (4, 11)

    def test_unknown_raises(self):
        with pytest.raises(WalletNotFoundError):
            WalletService.get_balance(99999)
