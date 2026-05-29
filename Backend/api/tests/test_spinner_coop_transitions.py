"""
Tests for transition functions.

Coverage targets:
  - Every public transition: happy path + at least one error path
  - Every drop-off matrix cell (state × disconnect)
  - Sequence number monotonicity
  - Side effect emission (DEBIT_GEMS / REFUND_GEMS / CREDIT_COUPOINTS / SCHEDULE_TIMER)
  - Payout invariant: Σshare == G·M (carried through to room.reveal payload)
"""

from __future__ import annotations

import random
import uuid

import pytest

from api.spinner_coop import transitions as T
from api.spinner_coop.events import TransitionError
from api.spinner_coop.room import Player, Room
from api.spinner_coop.states import (
    CHARGING_DURATION_MS,
    COUNTDOWN_DURATION_MS,
    ErrorCode,
    LOBBY_TTL_MS,
    MAX_PLAYERS,
    Phase,
    SPINNING_DURATION_MS,
    SideEffectKind,
)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

def _create(host_id: str = "alice", solo: bool = False, now: int = 1000):
    return T.create_room(
        host_id=host_id,
        host_display_name=host_id.title(),
        solo=solo,
        now_ms=now,
        room_id_factory=lambda: f"room-{host_id}",
        code_factory=lambda: "ABCDEF",
    )


def _join(room: Room, uid: str, *, now: int = 1100):
    return T.join_room(room, user_id=uid, display_name=uid.title(), now_ms=now)


def _build_charging_room(rng_seed: int = 0) -> Room:
    """Helper: build a 2-player room in CHARGING phase, both fully charged."""
    r = _create("alice", now=1000).room
    r = _join(r, "bob", now=1100).room
    r = T.set_stake(r, user_id="alice", gems=3, now_ms=1200).room
    r = T.set_stake(r, user_id="bob", gems=2, now_ms=1300).room
    r = T.lock_stake(r, user_id="alice", now_ms=1400).room
    r = T.lock_stake(r, user_id="bob", now_ms=1500).room
    assert r.phase == Phase.READY
    r = T.start_countdown(r, user_id="alice", now_ms=1600).room
    r = T.complete_countdown(r, now_ms=1600 + COUNTDOWN_DURATION_MS).room
    assert r.phase == Phase.CHARGING
    # Press in both, then advance time to reach charge=1.0 for everyone
    r = T.press_in(r, user_id="alice", now_ms=5000).room
    r = T.press_in(r, user_id="bob", now_ms=5000).room
    return r


def _seqs(result) -> list[int]:
    return [e.seq for e in result.events]


# ---------------------------------------------------------------------------
# create_room
# ---------------------------------------------------------------------------

class TestCreateRoom:
    def test_solo_starts_in_solo_phase(self):
        # Solo rooms stay in SOLO until a stake/lock; this lets join_room reject joiners.
        r = _create("alice", solo=True).room
        assert r.phase == Phase.SOLO
        assert r.host_id == "alice"
        assert r.num_players() == 1

    def test_multi_starts_in_lobby_open(self):
        r = _create("alice", solo=False).room
        assert r.phase == Phase.LOBBY_OPEN

    def test_emits_room_created_event(self):
        result = _create("alice")
        assert len(result.events) == 1
        ev = result.events[0]
        assert ev.type == "room.created"
        assert ev.body["host_id"] == "alice"
        assert ev.body["max_players"] == MAX_PLAYERS
        assert ev.seq == 1

    def test_lobby_expires_set(self):
        r = _create("alice", now=1000).room
        assert r.expires_at_ms == 1000 + LOBBY_TTL_MS


# ---------------------------------------------------------------------------
# join_room
# ---------------------------------------------------------------------------

class TestJoinRoom:
    def test_happy_path(self):
        r = _create("alice").room
        result = _join(r, "bob")
        assert result.room.num_players() == 2
        assert result.room.find_player("bob").seat == 1

    def test_third_player_goes_to_seat_2(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        r = _join(r, "carol").room
        assert r.find_player("carol").seat == 2

    def test_room_full(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        r = _join(r, "carol").room
        with pytest.raises(TransitionError) as exc:
            _join(r, "dave")
        assert exc.value.code == ErrorCode.ROOM_FULL

    def test_already_in_room(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        with pytest.raises(TransitionError) as exc:
            _join(r, "bob")
        assert exc.value.code == ErrorCode.ALREADY_IN_ROOM

    def test_solo_room_rejects_join(self):
        r = _create("alice", solo=True).room
        with pytest.raises(TransitionError) as exc:
            _join(r, "bob")
        assert exc.value.code == ErrorCode.INVALID_STATE

    def test_join_after_lobby_expired(self):
        r = _create("alice", now=1000).room
        with pytest.raises(TransitionError) as exc:
            _join(r, "bob", now=1000 + LOBBY_TTL_MS + 1)
        assert exc.value.code == ErrorCode.ROOM_EXPIRED

    def test_join_during_staking_allowed(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        r = T.set_stake(r, user_id="alice", gems=2, now_ms=1200).room
        assert r.phase == Phase.STAKING
        result = _join(r, "carol")
        assert result.room.num_players() == 3

    def test_join_after_ready_rejected(self):
        # 2 players, both lock → READY, then 3rd tries to join
        r = _create("alice").room
        r = _join(r, "bob").room
        r = T.lock_stake(r, user_id="alice", now_ms=1200).room
        r = T.lock_stake(r, user_id="bob", now_ms=1300).room
        assert r.phase == Phase.READY
        with pytest.raises(TransitionError) as exc:
            _join(r, "carol")
        assert exc.value.code == ErrorCode.INVALID_STATE


# ---------------------------------------------------------------------------
# leave_room + handle_disconnect (drop-off matrix)
# ---------------------------------------------------------------------------

class TestDropOffMatrix:
    """Every (phase, who) combination should land in the right end-state."""

    def test_joiner_leaves_lobby_frees_slot(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        result = T.leave_room(r, user_id="bob", now_ms=1200)
        assert result.room.num_players() == 1
        assert result.room.phase == Phase.LOBBY_OPEN

    def test_host_leaves_lobby_promotes(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        result = T.leave_room(r, user_id="alice", now_ms=1200)
        assert result.room.host_id == "bob"
        # Two events: room.left + room.host_changed
        assert {e.type for e in result.events} == {"room.left", "room.host_changed"}

    def test_last_player_leaves_disposes_room(self):
        r = _create("alice", solo=True).room
        result = T.leave_room(r, user_id="alice", now_ms=1200)
        assert result.room.phase == Phase.DISPOSED
        assert any(
            eff.kind == SideEffectKind.DISPOSE_ROOM for eff in result.side_effects
        )

    @pytest.mark.parametrize(
        "phase_setup",
        [
            "ready",
            "countdown",
            "charging",
        ],
    )
    def test_disconnect_in_high_risk_phases_aborts(self, phase_setup):
        r = _create("alice").room
        r = _join(r, "bob").room
        r = T.lock_stake(r, user_id="alice", now_ms=1200).room
        r = T.lock_stake(r, user_id="bob", now_ms=1300).room
        if phase_setup == "ready":
            target = r
        elif phase_setup == "countdown":
            target = T.start_countdown(r, user_id="alice", now_ms=1400).room
        else:  # charging
            r = T.start_countdown(r, user_id="alice", now_ms=1400).room
            target = T.complete_countdown(r, now_ms=1400 + COUNTDOWN_DURATION_MS).room

        result = T.handle_disconnect(target, user_id="bob", now_ms=2000)
        assert result.room.phase == Phase.DISPOSED
        assert any(e.type == "room.aborted" for e in result.events)

    def test_disconnect_in_spinning_refunds(self):
        r = _build_charging_room()
        # tick to push everyone to charge=1.0 → triggers SPINNING
        r = T.tick_charge_progress(r, now_ms=10_000, rng=random.Random(0)).room
        assert r.phase == Phase.SPINNING
        result = T.handle_disconnect(r, user_id="bob", now_ms=11_000)
        assert result.room.phase == Phase.DISPOSED
        # REFUND_GEMS for both players
        refund_effects = [
            e for e in result.side_effects if e.kind == SideEffectKind.REFUND_GEMS
        ]
        assert len(refund_effects) == 1
        refunded = refund_effects[0].payload["refunds"]
        assert refunded == {"alice": 3, "bob": 2}

    def test_disconnect_in_reveal_keeps_player_with_grace(self):
        r = _build_charging_room()
        r = T.tick_charge_progress(r, now_ms=10_000, rng=random.Random(0)).room
        r = T.complete_spinning(r, now_ms=10_000 + SPINNING_DURATION_MS).room
        assert r.phase == Phase.REVEAL
        result = T.handle_disconnect(r, user_id="bob", now_ms=12_000)
        # Phase stays REVEAL; player marked disconnected with grace
        assert result.room.phase == Phase.REVEAL
        bob = result.room.find_player("bob")
        assert bob.connected is False
        assert bob.grace_until_ms is not None


# ---------------------------------------------------------------------------
# Staking
# ---------------------------------------------------------------------------

class TestStaking:
    def test_set_stake_valid_range(self):
        r = _create("alice").room
        for v in (1, 5):
            result = T.set_stake(r, user_id="alice", gems=v, now_ms=1000)
            assert result.room.find_player("alice").stake == v

    def test_set_stake_out_of_range(self):
        r = _create("alice").room
        for bad in (0, 6, -1, 100):
            with pytest.raises(TransitionError) as exc:
                T.set_stake(r, user_id="alice", gems=bad, now_ms=1000)
            assert exc.value.code == ErrorCode.STAKE_OUT_OF_RANGE

    def test_set_stake_clears_lock(self):
        r = _create("alice").room
        r = T.lock_stake(r, user_id="alice", now_ms=1000).room
        assert r.find_player("alice").locked
        # Single-player solo: lock → READY. Re-stake forbidden then.
        # Multi-player: changing stake while only one locked still works (player still in STAKING).
        r2 = _create("alice").room
        r2 = _join(r2, "bob").room
        r2 = T.lock_stake(r2, user_id="alice", now_ms=1000).room
        assert r2.find_player("alice").locked
        r2 = T.set_stake(r2, user_id="alice", gems=4, now_ms=1100).room
        assert r2.find_player("alice").locked is False
        assert r2.find_player("alice").stake == 4

    def test_lock_unlock_sequence(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        r = T.lock_stake(r, user_id="alice", now_ms=1000).room
        assert r.phase == Phase.STAKING
        r = T.unlock_stake(r, user_id="alice", now_ms=1100).room
        assert not r.find_player("alice").locked

    def test_unlock_after_ready_rejected(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        r = T.lock_stake(r, user_id="alice", now_ms=1000).room
        r = T.lock_stake(r, user_id="bob", now_ms=1100).room
        assert r.phase == Phase.READY
        with pytest.raises(TransitionError) as exc:
            T.unlock_stake(r, user_id="alice", now_ms=1200)
        assert exc.value.code == ErrorCode.INVALID_STATE

    def test_all_locked_promotes_to_ready(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        result = T.lock_stake(
            T.lock_stake(r, user_id="alice", now_ms=1000).room,
            user_id="bob",
            now_ms=1100,
        )
        assert result.room.phase == Phase.READY
        # Auto-countdown timer scheduled
        assert any(
            eff.kind == SideEffectKind.SCHEDULE_TIMER
            and eff.payload["kind"] == "auto_countdown"
            for eff in result.side_effects
        )

    def test_lock_idempotent(self):
        r = _create("alice", solo=True).room
        r1 = T.lock_stake(r, user_id="alice", now_ms=1000).room
        result = T.lock_stake(r1, user_id="alice", now_ms=1100)
        # No new events; room unchanged (phase stays READY since solo+1-locked)
        assert result.events == ()
        assert result.room is r1


# ---------------------------------------------------------------------------
# Countdown / charging
# ---------------------------------------------------------------------------

class TestCountdown:
    def test_only_host_can_start(self):
        r = _create("alice").room
        r = _join(r, "bob").room
        r = T.lock_stake(r, user_id="alice", now_ms=1000).room
        r = T.lock_stake(r, user_id="bob", now_ms=1100).room
        with pytest.raises(TransitionError) as exc:
            T.start_countdown(r, user_id="bob", now_ms=1200)
        assert exc.value.code == ErrorCode.FORBIDDEN

    def test_countdown_emits_tick_3(self):
        r = _create("alice", solo=True).room
        r = T.lock_stake(r, user_id="alice", now_ms=1000).room
        result = T.start_countdown(r, user_id="alice", now_ms=1100)
        ev = result.events[0]
        assert ev.type == "room.countdown"
        assert ev.body["tick"] == 3
        assert ev.body["duration_ms"] == COUNTDOWN_DURATION_MS

    def test_complete_countdown_enters_charging(self):
        r = _create("alice", solo=True).room
        r = T.lock_stake(r, user_id="alice", now_ms=1000).room
        r = T.start_countdown(r, user_id="alice", now_ms=1100).room
        result = T.complete_countdown(r, now_ms=1100 + COUNTDOWN_DURATION_MS)
        assert result.room.phase == Phase.CHARGING
        assert result.events[0].type == "room.charging"


class TestCharging:
    def test_press_in_then_progress_advances(self):
        r = _build_charging_room()
        # 2.5s after press_in — both at full charge
        result = T.tick_charge_progress(r, now_ms=5000 + CHARGING_DURATION_MS, rng=random.Random(0))
        # Reached SPINNING (auto)
        assert result.room.phase == Phase.SPINNING

    def test_press_out_pauses_charge(self):
        r = _build_charging_room()
        # Halfway through
        mid = 5000 + CHARGING_DURATION_MS // 2
        r = T.press_out(r, user_id="alice", now_ms=mid).room
        alice = r.find_player("alice")
        assert not alice.is_charging
        assert 0.0 < alice.charge < 1.0

    def test_charging_completes_only_when_all_full(self):
        r = _build_charging_room()
        # Only alice charges fully; bob released early
        r = T.press_out(r, user_id="bob", now_ms=5500).room
        result = T.tick_charge_progress(r, now_ms=5000 + CHARGING_DURATION_MS, rng=random.Random(0))
        assert result.room.phase == Phase.CHARGING


# ---------------------------------------------------------------------------
# SPINNING + REVEAL + SETTLED  (end-to-end happy path)
# ---------------------------------------------------------------------------

class TestEndToEnd:
    def test_full_flow_with_invariants(self):
        """Build a room, drive it through every phase, and verify the payout
        invariant on the emitted room.reveal payload."""
        r = _build_charging_room()
        # Push to SPINNING via tick
        result = T.tick_charge_progress(r, now_ms=5000 + CHARGING_DURATION_MS, rng=random.Random(42))
        r = result.room
        # DEBIT_GEMS effect emitted
        debit = next(
            (e for e in result.side_effects if e.kind == SideEffectKind.DEBIT_GEMS),
            None,
        )
        assert debit is not None
        assert debit.payload["debits"] == {"alice": 3, "bob": 2}

        # SPINNING → REVEAL after spin duration
        result = T.complete_spinning(r, now_ms=5000 + CHARGING_DURATION_MS + SPINNING_DURATION_MS)
        r = result.room
        reveal = next((e for e in result.events if e.type == "room.reveal"), None)
        assert reveal is not None
        body = reveal.body
        # Σshare == G·M invariant
        total = sum(s["share"] for s in body["shares"])
        assert total == body["G_total"] * body["M"] == body["total_payout"]
        # share = floor + excess
        for s in body["shares"]:
            assert s["share"] == s["floor"] + s["excess"]
            assert s["excess"] >= 0

        # All players ack → SETTLED
        rid = body["round_id"]
        result = T.ack_reveal(r, user_id="alice", round_id=rid, now_ms=20_000)
        r = result.room
        result = T.ack_reveal(r, user_id="bob", round_id=rid, now_ms=20_500)
        assert result.room.phase == Phase.SETTLED
        # CREDIT_COUPOINTS effect emitted
        credit = next(
            (e for e in result.side_effects if e.kind == SideEffectKind.CREDIT_COUPOINTS),
            None,
        )
        assert credit is not None
        assert sum(credit.payload["credits"].values()) == body["total_payout"]
        # PERSIST_ROUND effect for ledger
        persist = next(
            (e for e in result.side_effects if e.kind == SideEffectKind.PERSIST_ROUND),
            None,
        )
        assert persist is not None
        assert persist.payload["round_id"] == rid

    def test_reveal_timeout_forces_settled(self):
        r = _build_charging_room()
        r = T.tick_charge_progress(r, now_ms=5000 + CHARGING_DURATION_MS, rng=random.Random(0)).room
        r = T.complete_spinning(r, now_ms=10_000).room
        # No acks; timeout fires
        result = T.reveal_timeout(r, now_ms=20_000)
        assert result.room.phase == Phase.SETTLED


# ---------------------------------------------------------------------------
# Rematch
# ---------------------------------------------------------------------------

class TestRematch:
    def test_rematch_returns_to_staking_with_clean_slate(self):
        r = _build_charging_room()
        r = T.tick_charge_progress(r, now_ms=5000 + CHARGING_DURATION_MS, rng=random.Random(0)).room
        r = T.complete_spinning(r, now_ms=10_000).room
        rid = r.round_id
        r = T.ack_reveal(r, user_id="alice", round_id=rid, now_ms=10_500).room
        r = T.ack_reveal(r, user_id="bob", round_id=rid, now_ms=10_600).room
        assert r.phase == Phase.SETTLED

        result = T.request_rematch(r, user_id="alice", now_ms=11_000)
        assert result.room.phase == Phase.STAKING
        # Stakes reset, locks cleared, charges zeroed
        for p in result.room.players:
            assert p.stake == 1
            assert p.locked is False
            assert p.charge == 0.0
        assert result.room.round_id is None
        assert result.room.round_M is None

    def test_rematch_in_wrong_phase(self):
        r = _create("alice", solo=True).room
        with pytest.raises(TransitionError) as exc:
            T.request_rematch(r, user_id="alice", now_ms=1000)
        assert exc.value.code == ErrorCode.INVALID_STATE


# ---------------------------------------------------------------------------
# Reconnect
# ---------------------------------------------------------------------------

class TestReconnect:
    def test_reconnect_within_grace(self):
        r = _build_charging_room()
        r = T.tick_charge_progress(r, now_ms=5000 + CHARGING_DURATION_MS, rng=random.Random(0)).room
        r = T.complete_spinning(r, now_ms=10_000).room
        # bob disconnects
        r = T.handle_disconnect(r, user_id="bob", now_ms=11_000).room
        assert not r.find_player("bob").connected
        # bob reconnects 5s later
        result = T.reconnect_player(r, user_id="bob", now_ms=16_000)
        bob = result.room.find_player("bob")
        assert bob.connected
        assert bob.grace_until_ms is None

    def test_reconnect_after_grace_expired(self):
        r = _build_charging_room()
        r = T.tick_charge_progress(r, now_ms=5000 + CHARGING_DURATION_MS, rng=random.Random(0)).room
        r = T.complete_spinning(r, now_ms=10_000).room
        r = T.handle_disconnect(r, user_id="bob", now_ms=11_000).room
        # Reconnect 60s later — past grace
        result = T.reconnect_player(r, user_id="bob", now_ms=11_000 + 60_000)
        # Bob removed (treated as fresh exit)
        assert result.room.find_player("bob") is None


# ---------------------------------------------------------------------------
# Sequence number monotonicity
# ---------------------------------------------------------------------------

class TestSequenceNumbers:
    def test_seq_increments_per_event(self):
        result = _create("alice")
        last = result.room.seq
        result = _join(result.room, "bob")
        assert result.events[0].seq == last + 1
        assert result.room.seq == last + 1

        # Multi-event transition (lock_stake → READY emits 2 events)
        result = T.lock_stake(result.room, user_id="alice", now_ms=1000)
        # First event is room.staked (seq +1); no READY transition yet (bob not locked)
        assert result.events[0].seq == result.room.seq

        result = T.lock_stake(result.room, user_id="bob", now_ms=1100)
        # room.staked + room.ready
        assert len(result.events) == 2
        assert result.events[0].seq + 1 == result.events[1].seq
        assert result.events[1].seq == result.room.seq


# ---------------------------------------------------------------------------
# Payout invariant (carried through emitted reveal payload across many seeds)
# ---------------------------------------------------------------------------

class TestPayoutInvariantInReveal:
    @pytest.mark.parametrize("seed", range(20))
    def test_invariant_holds_in_reveal_payload(self, seed):
        rng = random.Random(seed)
        r = _build_charging_room()
        r = T.tick_charge_progress(r, now_ms=5000 + CHARGING_DURATION_MS, rng=rng).room
        result = T.complete_spinning(r, now_ms=10_000)
        body = result.events[0].body
        assert sum(s["share"] for s in body["shares"]) == body["G_total"] * body["M"]
