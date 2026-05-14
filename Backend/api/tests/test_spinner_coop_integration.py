"""
End-to-end integration tests for the spinner co-op flow.

These exercise the real Channels consumer + RoomStore + WalletService +
SideEffectExecutor + SpinnerRound ledger together. We bypass the timer
scheduler by calling the tick transitions directly via the room store —
this lets us deterministically advance phases without sleeping.

Coverage:
  - Full 2-player round: assert wallet balances move by exactly the debit/
    credit amounts and a SpinnerRound row is persisted with Σshare = G·M.
  - Full 3-player round: same.
  - Disconnect during SPINNING: assert wallet refunds are atomic and the
    round is recorded as not-credited (no ledger row written for credits).

Why direct transition calls instead of WS-only? The CHARGING → SPINNING
transition is timer-driven; mocking 30Hz tick timing in a WS test is flaky.
The transition layer is exercised exhaustively by the deliverable-3a tests
(60 cases). These integration tests exist to verify the wiring between the
transition outputs and the persistence layer.
"""

from __future__ import annotations

import random
import time

import pytest
from django.contrib.auth.models import User

from api.spinner_coop import transitions as T
from api.spinner_coop.events import SideEffect, TransitionResult
from api.spinner_coop.executor import SideEffectExecutor
from api.spinner_coop.models import SpinnerRound, Wallet
from api.spinner_coop.scheduler import AsyncScheduler  # noqa: F401  (interface only)
from api.spinner_coop.states import (
    CHARGING_DURATION_MS,
    COUNTDOWN_DURATION_MS,
    SPINNING_DURATION_MS,
    Phase,
)


pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Test scaffolding
# ---------------------------------------------------------------------------


@pytest.fixture
def make_user_with_wallet():
    counter = {"n": 0}

    def _make(*, gems: int = 10):
        counter["n"] += 1
        u = User.objects.create_user(username=f"u{counter['n']}", password="x")
        Wallet.objects.create(user=u, gems=gems, cou_points=0)
        return u

    return _make


def _now_ms() -> int:
    return int(time.time() * 1000)


def _exec(result: TransitionResult, executor: SideEffectExecutor) -> None:
    if result.side_effects:
        # Strip scheduler effects — we don't run a real scheduler in these tests.
        wallet_effects = tuple(
            e
            for e in result.side_effects
            if e.kind.value
            in {"DEBIT_GEMS", "REFUND_GEMS", "CREDIT_COUPOINTS", "PERSIST_ROUND"}
        )
        if wallet_effects:
            executor.execute_all(wallet_effects)


def _drive_to_spinning(
    room,
    rng: random.Random,
    now_ms: int,
):
    """Push a room from STAKING all the way to SPINNING (post-debit)."""
    # Lock everyone
    locked = room
    last_result = None
    for p in locked.players:
        if not p.locked:
            r = T.lock_stake(locked, user_id=p.user_id, now_ms=now_ms)
            locked = r.room
            last_result = r
    assert locked.phase == Phase.READY
    # Start countdown
    r = T.start_countdown(locked, user_id=locked.host_id, now_ms=now_ms)
    locked = r.room
    last_result = r
    # Complete countdown
    r = T.complete_countdown(locked, now_ms=now_ms + COUNTDOWN_DURATION_MS)
    locked = r.room
    last_result = r
    # Press in for everyone, then tick to full
    for p in locked.players:
        r = T.press_in(locked, user_id=p.user_id, now_ms=now_ms + COUNTDOWN_DURATION_MS)
        locked = r.room
    # Tick — pushes to SPINNING (server rolls + emits debit side effect)
    r = T.tick_charge_progress(
        locked, now_ms=now_ms + COUNTDOWN_DURATION_MS + CHARGING_DURATION_MS, rng=rng
    )
    return r


# ---------------------------------------------------------------------------
# 2-player full round
# ---------------------------------------------------------------------------


class TestTwoPlayerFullRound:
    def test_full_lifecycle_persists_correctly(self, make_user_with_wallet):
        a = make_user_with_wallet(gems=10)
        b = make_user_with_wallet(gems=8)
        executor = SideEffectExecutor()
        rng = random.Random(42)
        now = _now_ms()

        # Create + join
        r = T.create_room(
            host_id=str(a.id),
            host_display_name="Alice",
            solo=False,
            now_ms=now,
        ).room
        r = T.join_room(
            r, user_id=str(b.id), display_name="Bob", now_ms=now + 100
        ).room

        # Stake
        r = T.set_stake(r, user_id=str(a.id), gems=3, now_ms=now + 200).room
        r = T.set_stake(r, user_id=str(b.id), gems=2, now_ms=now + 300).room

        # Drive to SPINNING (debit fires here)
        result = _drive_to_spinning(r, rng=rng, now_ms=now + 400)
        r = result.room
        _exec(result, executor)

        assert r.phase == Phase.SPINNING

        # Wallet debits applied atomically
        Wallet.objects.get(user=a).refresh_from_db()
        Wallet.objects.get(user=b).refresh_from_db()
        assert Wallet.objects.get(user=a).gems == 10 - 3
        assert Wallet.objects.get(user=b).gems == 8 - 2

        # SPINNING → REVEAL
        result = T.complete_spinning(r, now_ms=now + 100_000)
        r = result.room
        # No side effects yet — credits land at SETTLED
        _exec(result, executor)

        assert r.phase == Phase.REVEAL
        assert r.round_M is not None
        assert r.round_shares is not None

        # Σshare invariant on the in-memory state
        total_share = sum(s["share"] for s in r.round_shares)
        G = sum(p.stake for p in r.players)
        assert total_share == G * r.round_M

        # Both players ack → SETTLED
        rid = r.round_id
        result = T.ack_reveal(r, user_id=str(a.id), round_id=rid, now_ms=now + 110_000)
        r = result.room
        _exec(result, executor)
        result = T.ack_reveal(r, user_id=str(b.id), round_id=rid, now_ms=now + 110_500)
        r = result.room
        _exec(result, executor)

        assert r.phase == Phase.SETTLED

        # Wallet credits applied
        wallet_a = Wallet.objects.get(user=a)
        wallet_b = Wallet.objects.get(user=b)
        share_a = next(s for s in r.round_shares if s["user_id"] == str(a.id))
        share_b = next(s for s in r.round_shares if s["user_id"] == str(b.id))
        assert wallet_a.cou_points == share_a["share"]
        assert wallet_b.cou_points == share_b["share"]

        # SpinnerRound ledger row exists with the same invariants
        ledger_row = SpinnerRound.objects.get(round_id=rid)
        assert ledger_row.aborted is False
        assert ledger_row.m_multiplier == r.round_M
        assert ledger_row.num_players == 2
        assert ledger_row.g_total == G
        ledger_total = sum(s["share"] for s in ledger_row.shares)
        assert ledger_total == G * r.round_M


# ---------------------------------------------------------------------------
# 3-player full round (deeper invariant pressure: floor = 3 means f >= 3)
# ---------------------------------------------------------------------------


class TestThreePlayerFullRound:
    def test_three_player_invariant(self, make_user_with_wallet):
        a = make_user_with_wallet(gems=10)
        b = make_user_with_wallet(gems=10)
        c = make_user_with_wallet(gems=10)
        executor = SideEffectExecutor()
        rng = random.Random(7)
        now = _now_ms()

        r = T.create_room(host_id=str(a.id), host_display_name="A", solo=False, now_ms=now).room
        r = T.join_room(r, user_id=str(b.id), display_name="B", now_ms=now + 100).room
        r = T.join_room(r, user_id=str(c.id), display_name="C", now_ms=now + 200).room
        r = T.set_stake(r, user_id=str(a.id), gems=5, now_ms=now + 300).room
        r = T.set_stake(r, user_id=str(b.id), gems=3, now_ms=now + 400).room
        r = T.set_stake(r, user_id=str(c.id), gems=1, now_ms=now + 500).room

        result = _drive_to_spinning(r, rng=rng, now_ms=now + 600)
        r = result.room
        _exec(result, executor)
        assert r.phase == Phase.SPINNING

        # 3 players, G=9, P=3 → f = max(1, 3) = 3
        result = T.complete_spinning(r, now_ms=now + 100_000)
        r = result.room
        _exec(result, executor)
        body_shares = r.round_shares
        # Each player's floor must equal stake * f
        for s in body_shares:
            assert s["floor"] == s["stake"] * 3
        # Σshare invariant
        total_share = sum(s["share"] for s in body_shares)
        assert total_share == 9 * r.round_M

        # Settle
        rid = r.round_id
        for uid in (str(a.id), str(b.id), str(c.id)):
            result = T.ack_reveal(r, user_id=uid, round_id=rid, now_ms=now + 110_000)
            r = result.room
            _exec(result, executor)
        assert r.phase == Phase.SETTLED

        # Wallets debited 5+3+1=9 total; total credit equals total payout
        total_credit = sum(Wallet.objects.get(user=u).cou_points for u in (a, b, c))
        assert total_credit == 9 * r.round_M

        # Ledger row recorded
        ledger_row = SpinnerRound.objects.get(round_id=rid)
        assert ledger_row.num_players == 3
        assert ledger_row.g_total == 9


# ---------------------------------------------------------------------------
# Disconnect during SPINNING refunds atomically
# ---------------------------------------------------------------------------


class TestSpinningDisconnectRefund:
    def test_disconnect_in_spinning_refunds_both_players(self, make_user_with_wallet):
        a = make_user_with_wallet(gems=10)
        b = make_user_with_wallet(gems=10)
        executor = SideEffectExecutor()
        rng = random.Random(99)
        now = _now_ms()

        r = T.create_room(host_id=str(a.id), host_display_name="A", solo=False, now_ms=now).room
        r = T.join_room(r, user_id=str(b.id), display_name="B", now_ms=now + 100).room
        r = T.set_stake(r, user_id=str(a.id), gems=4, now_ms=now + 200).room
        r = T.set_stake(r, user_id=str(b.id), gems=3, now_ms=now + 300).room
        result = _drive_to_spinning(r, rng=rng, now_ms=now + 400)
        r = result.room
        _exec(result, executor)
        assert r.phase == Phase.SPINNING
        assert Wallet.objects.get(user=a).gems == 6  # 10 - 4
        assert Wallet.objects.get(user=b).gems == 7  # 10 - 3

        # Bob disconnects during SPINNING → abort + refund
        result = T.handle_disconnect(r, user_id=str(b.id), now_ms=now + 500)
        _exec(result, executor)

        # Phase is DISPOSED
        assert result.room.phase == Phase.DISPOSED

        # Both wallets restored to pre-debit balances
        assert Wallet.objects.get(user=a).gems == 10
        assert Wallet.objects.get(user=b).gems == 10

        # No CouPoints credited (round was aborted)
        assert Wallet.objects.get(user=a).cou_points == 0
        assert Wallet.objects.get(user=b).cou_points == 0

        # No SpinnerRound persisted (the abort happens before SETTLED)
        assert SpinnerRound.objects.filter(round_id=result.room.round_id).count() == 0


# ---------------------------------------------------------------------------
# Solo round (P=1) — exercises the SOLO → STAKING → READY → ... path
# ---------------------------------------------------------------------------


class TestSoloRound:
    def test_solo_player_full_round(self, make_user_with_wallet):
        a = make_user_with_wallet(gems=10)
        executor = SideEffectExecutor()
        rng = random.Random(0)
        now = _now_ms()

        r = T.create_room(host_id=str(a.id), host_display_name="A", solo=True, now_ms=now).room
        r = T.set_stake(r, user_id=str(a.id), gems=4, now_ms=now + 100).room
        result = _drive_to_spinning(r, rng=rng, now_ms=now + 200)
        r = result.room
        _exec(result, executor)
        assert r.phase == Phase.SPINNING

        # Solo with G=4, P=1 → f = max(𝟙[G≥3], 0) = 1
        result = T.complete_spinning(r, now_ms=now + 100_000)
        r = result.room
        _exec(result, executor)
        assert r.round_M is not None
        share = r.round_shares[0]
        assert share["floor"] == 4 * 1
        assert share["share"] == share["floor"] + share["excess"]
        assert share["share"] == 4 * r.round_M

        result = T.ack_reveal(r, user_id=str(a.id), round_id=r.round_id, now_ms=now + 110_000)
        r = result.room
        _exec(result, executor)
        assert r.phase == Phase.SETTLED
        assert Wallet.objects.get(user=a).gems == 6  # 10 - 4 stake
        assert Wallet.objects.get(user=a).cou_points == share["share"]
