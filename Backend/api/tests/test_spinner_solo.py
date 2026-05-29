"""GET /api/spinner/ + POST /api/spinner/draw/ — server-authoritative solo draw.

Covers:
  * auth required
  * GET returns gems / floor / lastSpinAt
  * draw rejects when no gems
  * draw debits exactly 1 gem and credits gems_before × multiplier
  * meltdown only fires when base multiplier == 5
  * floor reaches 1 when gems >= 3
  * client/server gem desync returns 409
  * rate limit returns 429
  * ledger row written with kind=spinner_solo and correct snapshots
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from api.spinner_coop.models import Wallet, WalletTransaction


pytestmark = pytest.mark.django_db


@pytest.fixture
def consumer():
    return User.objects.create_user(username="spinner", password="x")


@pytest.fixture
def client(consumer):
    c = APIClient()
    c.force_authenticate(user=consumer)
    return c


@pytest.fixture
def wallet(consumer):
    return Wallet.objects.create(user=consumer, gems=0, cou_points=0)


# ── GET /api/spinner/ ─────────────────────────────────────────────────────────


class TestGetSpinnerState:
    def test_requires_auth(self):
        resp = APIClient().get("/api/spinner/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    @override_settings(STARTER_GEMS=3)
    def test_seeds_wallet_lazily(self, client, consumer):
        assert not Wallet.objects.filter(user=consumer).exists()
        resp = client.get("/api/spinner/")
        assert resp.status_code == 200
        body = resp.json()
        assert body["gems"] == 3
        assert body["floor"] == 1  # gems >= 3 → floor 1
        assert body["lastSpinAt"] is None

    @override_settings(STARTER_GEMS=0)
    def test_floor_zero_when_low_gems(self, client, wallet):
        wallet.gems = 2
        wallet.save()
        resp = client.get("/api/spinner/")
        assert resp.json()["floor"] == 0


# ── POST /api/spinner/draw/ ───────────────────────────────────────────────────


@pytest.fixture
def relaxed_settings(settings):
    """Disable rate limit and starter seed for draw tests."""
    settings.STARTER_GEMS = 0
    settings.SOLO_SPINNER_RATE_LIMIT_SECONDS = 0


@pytest.mark.usefixtures("relaxed_settings")
class TestPostSpinnerDraw:
    def test_requires_auth(self):
        resp = APIClient().post("/api/spinner/draw/", {}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_rejects_when_no_gems(self, client, wallet):
        resp = client.post("/api/spinner/draw/", {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert resp.json().get("error_code") == "NO_GEMS_TO_SPIN"

    def test_debits_one_gem_and_credits_pts(self, client, consumer, wallet):
        wallet.gems = 5
        wallet.save()
        # Stub the RNG so the test is deterministic
        with patch("api.views.spinner_views._roll_base_multiplier", return_value=3):
            resp = client.post("/api/spinner/draw/", {}, format="json")
        body = resp.json()
        assert resp.status_code == 200
        assert body["multiplier"] == 3
        assert body["meltdownMultiplier"] is None
        assert body["gemsUsed"] == 5
        assert body["pointsEarned"] == 15  # 5 gems × x3
        assert body["gems"] == 4  # cost = 1
        assert body["couPoints"] == 15
        # Ledger row
        tx = WalletTransaction.objects.get(id=body["transactionId"])
        assert tx.kind == WalletTransaction.Kind.SPINNER_SOLO
        assert tx.delta_gems == -1
        assert tx.delta_cou_points == 15
        assert tx.balance_after_gems == 4
        assert tx.balance_after_cou_points == 15

    def test_meltdown_fires_on_multiplier_5(self, client, wallet):
        wallet.gems = 5
        wallet.save()
        with patch("api.views.spinner_views._roll_base_multiplier", return_value=5), \
             patch("api.views.spinner_views._roll_meltdown", return_value=3):
            resp = client.post("/api/spinner/draw/", {}, format="json")
        body = resp.json()
        assert body["multiplier"] == 5
        assert body["meltdownMultiplier"] == 3
        assert body["pointsEarned"] == 5 * 5 * 3  # gems × base × meltdown
        assert body["couPoints"] == 75

    def test_no_meltdown_when_multiplier_below_5(self, client, wallet):
        wallet.gems = 1
        wallet.save()
        with patch("api.views.spinner_views._roll_base_multiplier", return_value=2), \
             patch("api.views.spinner_views._roll_meltdown", return_value=5):
            resp = client.post("/api/spinner/draw/", {}, format="json")
        assert resp.json()["meltdownMultiplier"] is None

    def test_floor_propagates(self, client, wallet):
        wallet.gems = 4
        wallet.save()
        captured = {}
        def spy(floor):
            captured["floor"] = floor
            return 0
        with patch("api.views.spinner_views._roll_base_multiplier", side_effect=spy):
            client.post("/api/spinner/draw/", {}, format="json")
        assert captured["floor"] == 1  # gems >= 3 → floor 1

    def test_desync_409_when_client_disagrees(self, client, wallet):
        wallet.gems = 2
        wallet.save()
        resp = client.post(
            "/api/spinner/draw/", {"gems": 99}, format="json"
        )
        assert resp.status_code == status.HTTP_409_CONFLICT
        assert resp.json().get("error_code") == "WALLET_GEMS_DESYNC"

    def test_accepts_matching_client_hint(self, client, wallet):
        wallet.gems = 2
        wallet.save()
        with patch("api.views.spinner_views._roll_base_multiplier", return_value=1):
            resp = client.post(
                "/api/spinner/draw/", {"gems": 2}, format="json"
            )
        assert resp.status_code == 200


class TestRateLimit:
    def test_second_call_within_window_429(self, client, wallet, settings):
        settings.SOLO_SPINNER_RATE_LIMIT_SECONDS = 60
        settings.STARTER_GEMS = 0
        wallet.gems = 5
        wallet.save()
        with patch("api.views.spinner_views._roll_base_multiplier", return_value=0):
            r1 = client.post("/api/spinner/draw/", {}, format="json")
            r2 = client.post("/api/spinner/draw/", {}, format="json")
        assert r1.status_code == 200
        assert r2.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert r2.json().get("error_code") == "SPIN_RATE_LIMITED"
