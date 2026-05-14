"""GET /api/wallet/ — Phase 1 wallet read endpoint.

Covers:
  * authentication required
  * camelCase response shape ({gems, couPoints})
  * lazy seeding with settings.STARTER_GEMS on first call
  * idempotency on subsequent calls (no re-seed)
  * starter grant writes a SEED WalletTransaction row
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from api.spinner_coop.models import Wallet, WalletTransaction


pytestmark = pytest.mark.django_db


@pytest.fixture
def consumer():
    return User.objects.create_user(username="walletter", password="x")


@pytest.fixture
def client(consumer):
    c = APIClient()
    c.force_authenticate(user=consumer)
    return c


class TestWalletEndpoint:
    def test_requires_authentication(self):
        unauth = APIClient()
        resp = unauth.get("/api/wallet/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    @override_settings(STARTER_GEMS=3)
    def test_first_call_seeds_starter_gems(self, client, consumer):
        assert not Wallet.objects.filter(user=consumer).exists()
        resp = client.get("/api/wallet/")
        assert resp.status_code == 200
        assert resp.json() == {"gems": 3, "couPoints": 0}
        w = Wallet.objects.get(user=consumer)
        assert w.gems == 3
        assert w.cou_points == 0
        # Seed ledger row
        seed = WalletTransaction.objects.get(user=consumer)
        assert seed.kind == WalletTransaction.Kind.SEED
        assert seed.delta_gems == 3
        assert seed.balance_after_gems == 3

    @override_settings(STARTER_GEMS=0)
    def test_zero_starter_no_ledger_row(self, client, consumer):
        resp = client.get("/api/wallet/")
        assert resp.status_code == 200
        assert resp.json() == {"gems": 0, "couPoints": 0}
        assert WalletTransaction.objects.filter(user=consumer).count() == 0

    @override_settings(STARTER_GEMS=5)
    def test_subsequent_calls_do_not_reseed(self, client, consumer):
        client.get("/api/wallet/")
        client.get("/api/wallet/")
        resp = client.get("/api/wallet/")
        assert resp.json() == {"gems": 5, "couPoints": 0}
        assert WalletTransaction.objects.filter(user=consumer).count() == 1

    @override_settings(STARTER_GEMS=2)
    def test_reflects_subsequent_mutations(self, client, consumer):
        from api.spinner_coop.wallet_service import WalletService
        client.get("/api/wallet/")  # seed
        WalletService.mutate(
            consumer.id,
            delta_gems=-1,
            delta_cou_points=+10,
            kind=WalletTransaction.Kind.SPINNER_SOLO,
        )
        resp = client.get("/api/wallet/")
        assert resp.json() == {"gems": 1, "couPoints": 10}
