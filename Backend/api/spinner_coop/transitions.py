"""
Pure transition functions for the spinner co-op state machine.

Every public function:
  - takes the current Room (and command args + now_ms + optional rng), and
  - returns a TransitionResult(new_room, events, side_effects), or
  - raises a TransitionError with an ErrorCode from spec §3.5.

No global state. No DB. No IO. No randomness except via the `rng` param.

The seq counter on each emitted Event is assigned here (incremented from
room.seq) so the consumer (3b) can broadcast events in deterministic order.

References:
- specs/spinner-coop/state-machine-and-events.md §2 (state machine), §3 (events)
- api/services/spinner_coop_draw.py (compute_round, used by complete_charging)
"""

from __future__ import annotations

import random
import uuid

from api.services.spinner_coop_draw import (
    PlayerStake,
    RoundResult,
    compute_round,
    floor_multiplier,
)

from .codes import generate_code
from .events import Event, SideEffect, TransitionError, TransitionResult
from .room import Player, Room
from .states import (
    ABORT_ON_DISCONNECT_PHASES,
    CHARGING_DURATION_MS,
    COUNTDOWN_AUTO_START_MS,
    COUNTDOWN_DURATION_MS,
    ErrorCode,
    JOINABLE_PHASES,
    LOBBY_TTL_MS,
    MAX_PLAYERS,
    Phase,
    REENTRY_GRACE_MS,
    REVEAL_TIMEOUT_MS,
    SPINNING_DURATION_MS,
    SideEffectKind,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _emit(room: Room, type_: str, body: dict) -> tuple[Room, Event]:
    """Bump room.seq, build Event with the new seq."""
    new_room = room.increment_seq()
    event = Event(type=type_, body=body, seq=new_room.seq)
    return new_room, event


def _require_phase(room: Room, *allowed: Phase) -> None:
    if room.phase not in allowed:
        raise TransitionError(
            ErrorCode.INVALID_STATE,
            f"command not allowed in phase {room.phase.value}; "
            f"requires one of {[p.value for p in allowed]}",
        )


def _require_player(room: Room, user_id: str) -> Player:
    p = room.find_player(user_id)
    if p is None:
        raise TransitionError(
            ErrorCode.FORBIDDEN, f"user {user_id} not in room {room.room_id}"
        )
    return p


def _require_host(room: Room, user_id: str) -> None:
    if not room.is_host(user_id):
        raise TransitionError(
            ErrorCode.FORBIDDEN, f"user {user_id} is not host of room {room.room_id}"
        )


# ---------------------------------------------------------------------------
# Room lifecycle
# ---------------------------------------------------------------------------

def create_room(
    *,
    host_id: str,
    host_display_name: str,
    host_avatar_url: str | None = None,
    solo: bool,
    now_ms: int,
    room_id_factory=lambda: str(uuid.uuid4()),
    code_factory=generate_code,
) -> TransitionResult:
    """Create a brand-new room. Solo path skips lobby and starts in STAKING."""
    initial_phase = Phase.SOLO if solo else Phase.LOBBY_OPEN
    host = Player(
        user_id=host_id,
        seat=0,
        display_name=host_display_name,
        avatar_url=host_avatar_url,
        stake=1,
        locked=False,
    )
    room = Room(
        room_id=room_id_factory(),
        code=code_factory(),
        host_id=host_id,
        phase=initial_phase,
        players=(host,),
        seq=0,
        created_at_ms=now_ms,
        expires_at_ms=now_ms + LOBBY_TTL_MS,
        is_solo=solo,
    )
    # H-4: is_solo is set explicitly; join_room rejects on this flag regardless
    # of phase, so a solo room that has advanced to STAKING still refuses joiners.

    room, event = _emit(
        room,
        "room.created",
        {
            "room_id": room.room_id,
            "code": room.code,
            "host_id": host_id,
            "max_players": MAX_PLAYERS,
            "expires_at": room.expires_at_ms,
            "state": room.phase.value,
            "players": [host.to_dict()],
        },
    )
    return TransitionResult(room=room, events=(event,))


def join_room(
    room: Room,
    *,
    user_id: str,
    display_name: str,
    avatar_url: str | None = None,
    now_ms: int,
) -> TransitionResult:
    """A new player joins. Allowed only in LOBBY_OPEN / STAKING (free-slot policy)."""
    if room.is_solo:
        # H-4: solo rooms refuse joiners regardless of current phase.
        raise TransitionError(ErrorCode.INVALID_STATE, "solo room cannot accept joiners")
    if room.phase in (Phase.SOLO,):
        raise TransitionError(ErrorCode.INVALID_STATE, "solo room cannot accept joiners")
    if room.phase not in JOINABLE_PHASES:
        raise TransitionError(
            ErrorCode.INVALID_STATE,
            f"join not allowed in phase {room.phase.value}",
        )
    if now_ms >= room.expires_at_ms and room.phase == Phase.LOBBY_OPEN:
        raise TransitionError(ErrorCode.ROOM_EXPIRED, "lobby has expired")
    if room.find_player(user_id) is not None:
        raise TransitionError(ErrorCode.ALREADY_IN_ROOM, "player already seated")
    if room.num_players() >= MAX_PLAYERS:
        raise TransitionError(ErrorCode.ROOM_FULL, "room is full")

    new_player = Player(
        user_id=user_id,
        seat=room.next_free_seat(),
        display_name=display_name,
        avatar_url=avatar_url,
    )
    new_room = room.add_player(new_player)
    # Joining during STAKING resets the joiner's lock to False (they need to lock too).
    # The joiner's default `locked=False` already satisfies this.

    new_room, event = _emit(
        new_room,
        "room.joined",
        {
            "player": new_player.to_dict(),
            "players": [p.to_dict() for p in new_room.players],
            "state": new_room.phase.value,
        },
    )
    return TransitionResult(room=new_room, events=(event,))


def leave_room(
    room: Room, *, user_id: str, reason: str = "voluntary", now_ms: int
) -> TransitionResult:
    """Voluntary leave. May trigger host promotion / room dispose / abort+refund
    depending on phase per the drop-off matrix."""
    return _handle_player_exit(room, user_id, reason=reason, now_ms=now_ms)


def handle_disconnect(room: Room, *, user_id: str, now_ms: int) -> TransitionResult:
    """Connection drop. Per drop-off matrix:
       - LOBBY_OPEN/STAKING: free-slot or promote (handled in _handle_player_exit)
       - READY/COUNTDOWN/CHARGING/SPINNING: abort-refund
       - REVEAL/SETTLED: keep player in room with grace timer; do not abort
    """
    if room.phase in (Phase.REVEAL, Phase.SETTLED):
        # Mark disconnected with re-entry grace; result is already committed
        player = _require_player(room, user_id)
        if not player.connected:
            return TransitionResult(room=room)
        new_player = player.with_changes(
            connected=False, grace_until_ms=now_ms + REENTRY_GRACE_MS
        )
        new_room = room.replace_player(user_id, new_player)
        new_room, event = _emit(
            new_room,
            "room.left",
            {
                "player_id": user_id,
                "reason": "disconnect",
                "host_changed_to": None,
                "players": [p.to_dict() for p in new_room.players],
                "state": new_room.phase.value,
            },
        )
        return TransitionResult(room=new_room, events=(event,))
    return _handle_player_exit(room, user_id, reason="disconnect", now_ms=now_ms)


def _handle_player_exit(
    room: Room, user_id: str, *, reason: str, now_ms: int
) -> TransitionResult:
    """Shared body for leave + disconnect (outside REVEAL/SETTLED)."""
    if room.find_player(user_id) is None:
        raise TransitionError(ErrorCode.FORBIDDEN, "player not in room")

    if room.phase in ABORT_ON_DISCONNECT_PHASES:
        return _abort_refund(
            room, reason="host_left" if room.is_host(user_id) else reason, now_ms=now_ms
        )

    # LOBBY_OPEN / STAKING: free-slot, promote host if needed
    new_room = room.remove_player(user_id)
    host_changed_to: str | None = None

    if not new_room.players:
        # Last player out: dispose
        new_room = new_room.with_changes(phase=Phase.DISPOSED)
        new_room, event = _emit(
            new_room,
            "room.left",
            {
                "player_id": user_id,
                "reason": reason,
                "host_changed_to": None,
                "players": [],
                "state": new_room.phase.value,
            },
        )
        return TransitionResult(
            room=new_room,
            events=(event,),
            side_effects=(SideEffect(SideEffectKind.DISPOSE_ROOM, {"room_id": new_room.room_id}),),
        )

    if room.is_host(user_id):
        # Promote oldest remaining player (lowest seat) to host
        promoted = min(new_room.players, key=lambda p: p.seat)
        new_room = new_room.with_changes(host_id=promoted.user_id)
        host_changed_to = promoted.user_id

    # If we were in STAKING and the leaver had locked, the room may now be all-locked
    # (one fewer player to wait for). However, spec says exiting STAKING requires every
    # remaining player to still have locked. We do NOT auto-promote to READY here;
    # explicit lock_stake from the last unlocked player triggers the check.
    if new_room.phase == Phase.STAKING and new_room.num_players() == 0:
        # Should not reach (handled above), but safe-guard
        new_room = new_room.with_changes(phase=Phase.DISPOSED)

    # If the leaver was in STAKING and there's only one player left who had locked,
    # we still keep STAKING. The remaining player can re-lock at will.

    new_room, leave_event = _emit(
        new_room,
        "room.left",
        {
            "player_id": user_id,
            "reason": reason,
            "host_changed_to": host_changed_to,
            "players": [p.to_dict() for p in new_room.players],
            "state": new_room.phase.value,
        },
    )
    events: tuple[Event, ...] = (leave_event,)
    if host_changed_to is not None:
        new_room, host_event = _emit(
            new_room,
            "room.host_changed",
            {
                "previous_host_id": user_id,
                "new_host_id": host_changed_to,
                "players": [p.to_dict() for p in new_room.players],
            },
        )
        events = events + (host_event,)
    return TransitionResult(room=new_room, events=events)


# ---------------------------------------------------------------------------
# Staking
# ---------------------------------------------------------------------------

def set_stake(
    room: Room, *, user_id: str, gems: int, now_ms: int
) -> TransitionResult:
    """Set or change a player's stake. Auto-enters STAKING from LOBBY_OPEN/SOLO."""
    if room.phase not in (Phase.SOLO, Phase.LOBBY_OPEN, Phase.STAKING):
        raise TransitionError(
            ErrorCode.INVALID_STATE,
            f"set_stake not allowed in phase {room.phase.value}",
        )
    if not isinstance(gems, int) or not (1 <= gems <= 5):
        raise TransitionError(
            ErrorCode.STAKE_OUT_OF_RANGE, f"gems must be int in [1,5]; got {gems!r}"
        )
    player = _require_player(room, user_id)

    new_player = player.with_changes(stake=gems, locked=False)
    new_room = room.replace_player(user_id, new_player)

    # Auto-promote LOBBY_OPEN/SOLO to STAKING
    if new_room.phase in (Phase.LOBBY_OPEN, Phase.SOLO):
        new_room = new_room.with_changes(phase=Phase.STAKING)

    new_room, event = _emit(
        new_room, "room.staked", _build_staked_payload(new_room)
    )
    return TransitionResult(room=new_room, events=(event,))


def lock_stake(
    room: Room, *, user_id: str, now_ms: int
) -> TransitionResult:
    """Player locks their stake. When everyone is locked, room transitions to READY."""
    player = _require_player(room, user_id)
    if player.locked:
        # Idempotent across any phase — repeated lock is a no-op
        return TransitionResult(room=room)
    if room.phase not in (Phase.SOLO, Phase.LOBBY_OPEN, Phase.STAKING):
        raise TransitionError(
            ErrorCode.INVALID_STATE,
            f"lock_stake not allowed in phase {room.phase.value}",
        )

    new_player = player.with_changes(locked=True)
    new_room = room.replace_player(user_id, new_player)
    if new_room.phase in (Phase.LOBBY_OPEN, Phase.SOLO):
        new_room = new_room.with_changes(phase=Phase.STAKING)

    new_room, staked_event = _emit(
        new_room, "room.staked", _build_staked_payload(new_room)
    )
    events: tuple[Event, ...] = (staked_event,)
    side_effects: tuple[SideEffect, ...] = ()

    if new_room.all_locked():
        new_room = new_room.with_changes(phase=Phase.READY)
        new_room, ready_event = _emit(
            new_room,
            "room.ready",
            {
                "players": [p.to_dict() for p in new_room.players],
                "G_total": new_room.gems_total(),
                "P": new_room.num_players(),
                "f": floor_multiplier(new_room.gems_total(), new_room.num_players()),
                "auto_countdown_in_ms": COUNTDOWN_AUTO_START_MS,
                "state": new_room.phase.value,
            },
        )
        events = events + (ready_event,)
        side_effects = side_effects + (
            SideEffect(
                SideEffectKind.SCHEDULE_TIMER,
                {
                    "kind": "auto_countdown",
                    "fire_at_ms": now_ms + COUNTDOWN_AUTO_START_MS,
                    "room_id": new_room.room_id,
                },
            ),
        )
    return TransitionResult(room=new_room, events=events, side_effects=side_effects)


def unlock_stake(
    room: Room, *, user_id: str, now_ms: int
) -> TransitionResult:
    """Player unlocks. Allowed only in STAKING (i.e., not after all-locked → READY)."""
    if room.phase != Phase.STAKING:
        raise TransitionError(
            ErrorCode.INVALID_STATE,
            f"unlock_stake not allowed in phase {room.phase.value}",
        )
    player = _require_player(room, user_id)
    if not player.locked:
        return TransitionResult(room=room)

    new_player = player.with_changes(locked=False)
    new_room = room.replace_player(user_id, new_player)
    new_room, event = _emit(
        new_room, "room.staked", _build_staked_payload(new_room)
    )
    return TransitionResult(room=new_room, events=(event,))


def _build_staked_payload(room: Room) -> dict:
    G = room.gems_total()
    P = room.num_players()
    return {
        "players": [p.to_dict() for p in room.players],
        "G_total": G,
        "P": P,
        "f_preview": floor_multiplier(G, P),
        "all_locked": room.all_locked(),
        "state": room.phase.value,
    }


# ---------------------------------------------------------------------------
# Countdown
# ---------------------------------------------------------------------------

def start_countdown(
    room: Room, *, user_id: str, now_ms: int
) -> TransitionResult:
    """Host (or auto-trigger after 2s idle) starts the 3-2-1 countdown."""
    _require_phase(room, Phase.READY)
    _require_host(room, user_id)
    new_room = room.with_changes(
        phase=Phase.COUNTDOWN, countdown_started_at_ms=now_ms
    )
    new_room, event = _emit(
        new_room,
        "room.countdown",
        {
            "tick": 3,
            "started_at": now_ms,
            "duration_ms": COUNTDOWN_DURATION_MS,
            "state": new_room.phase.value,
        },
    )
    side_effects = (
        SideEffect(
            SideEffectKind.SCHEDULE_TIMER,
            {
                "kind": "countdown_complete",
                "fire_at_ms": now_ms + COUNTDOWN_DURATION_MS,
                "room_id": new_room.room_id,
            },
        ),
    )
    return TransitionResult(room=new_room, events=(event,), side_effects=side_effects)


def auto_start_countdown(room: Room, *, now_ms: int) -> TransitionResult:
    """Server-side auto-trigger if host idles for COUNTDOWN_AUTO_START_MS."""
    if room.phase != Phase.READY:
        # Already advanced; ignore
        return TransitionResult(room=room)
    return start_countdown(room, user_id=room.host_id, now_ms=now_ms)


def complete_countdown(
    room: Room, *, now_ms: int, weights_map: dict[int, float] | None = None
) -> TransitionResult:
    """Timer-triggered: COUNTDOWN → SPINNING (skips CHARGING).

    Charging was removed because WebSocket latency made the simultaneous
    button-hold feel laggy.  We set all players to fully charged and
    immediately trigger the draw so the wheel spins right after the
    3-2-1 countdown. ``weights_map`` is forwarded to the roll (co-op odds).
    """
    if room.phase != Phase.COUNTDOWN:
        return TransitionResult(room=room)
    charged_players = tuple(
        p.with_changes(charge=1.0, is_charging=False) for p in room.players
    )
    new_room = room.with_changes(
        phase=Phase.CHARGING,
        charging_started_at_ms=now_ms,
        players=charged_players,
    )
    return complete_charging(new_room, now_ms=now_ms, weights_map=weights_map)


# ---------------------------------------------------------------------------
# Charging
# ---------------------------------------------------------------------------

def press_in(
    room: Room, *, user_id: str, now_ms: int
) -> TransitionResult:
    """Player begins holding the SPIN button."""
    _require_phase(room, Phase.CHARGING)
    player = _require_player(room, user_id)
    if player.charge >= 1.0:
        return TransitionResult(room=room)
    new_player = player.with_changes(is_charging=True, charge_started_at_ms=now_ms)
    new_room = room.replace_player(user_id, new_player)
    new_room, event = _emit(
        new_room,
        "room.charging",
        {
            "players": [p.to_dict() for p in new_room.players],
            "started_at": room.charging_started_at_ms,
            "duration_ms": CHARGING_DURATION_MS,
            "state": new_room.phase.value,
        },
    )
    return TransitionResult(room=new_room, events=(event,))


def press_out(
    room: Room, *, user_id: str, now_ms: int
) -> TransitionResult:
    """Player releases the SPIN button. Charge pauses (release_behavior=pause)."""
    _require_phase(room, Phase.CHARGING)
    player = _require_player(room, user_id)
    if not player.is_charging:
        return TransitionResult(room=room)
    # Compute final charge value at release
    new_charge = _compute_charge(player, now_ms)
    new_player = player.with_changes(
        is_charging=False, charge=new_charge, charge_started_at_ms=None
    )
    new_room = room.replace_player(user_id, new_player)
    new_room, event = _emit(
        new_room,
        "room.charging",
        {
            "players": [p.to_dict() for p in new_room.players],
            "started_at": room.charging_started_at_ms,
            "duration_ms": CHARGING_DURATION_MS,
            "state": new_room.phase.value,
        },
    )
    return TransitionResult(room=new_room, events=(event,))


def tick_charge_progress(
    room: Room,
    *,
    now_ms: int,
    rng: random.Random | None = None,
    weights_map: dict[int, float] | None = None,
) -> TransitionResult:
    """Periodic timer (10Hz) — recompute progress for all currently-charging players.
    Triggers CHARGING → SPINNING when every player is fully charged.
    ``weights_map`` is forwarded to the roll (co-op odds)."""
    if room.phase != Phase.CHARGING:
        return TransitionResult(room=room)

    new_players = []
    changed = False
    for p in room.players:
        if p.is_charging and p.charge < 1.0:
            new_charge = _compute_charge(p, now_ms)
            if new_charge != p.charge:
                changed = True
            new_players.append(p.with_changes(charge=new_charge))
        else:
            new_players.append(p)
    new_room = room.with_players(tuple(new_players))

    events: tuple[Event, ...] = ()
    side_effects: tuple[SideEffect, ...] = ()

    if changed:
        new_room, ev = _emit(
            new_room,
            "room.charging",
            {
                "players": [p.to_dict() for p in new_room.players],
                "started_at": room.charging_started_at_ms,
                "duration_ms": CHARGING_DURATION_MS,
                "state": new_room.phase.value,
            },
        )
        events = events + (ev,)

    if new_room.all_charged():
        # CHARGING → SPINNING (atomic gem debit + roll)
        spin_result = complete_charging(
            new_room, rng=rng, now_ms=now_ms, weights_map=weights_map
        )
        new_room = spin_result.room
        events = events + spin_result.events
        side_effects = side_effects + spin_result.side_effects

    return TransitionResult(room=new_room, events=events, side_effects=side_effects)


def _compute_charge(player: Player, now_ms: int) -> float:
    """Pure: compute current charge value [0..1] from the press-in epoch."""
    if not player.is_charging or player.charge_started_at_ms is None:
        return player.charge
    elapsed = max(0, now_ms - player.charge_started_at_ms)
    delta = elapsed / CHARGING_DURATION_MS
    return min(1.0, player.charge + delta)


# ---------------------------------------------------------------------------
# Spinning + reveal + settled
# ---------------------------------------------------------------------------

def complete_charging(
    room: Room,
    *,
    rng: random.Random | None = None,
    now_ms: int,
    weights_map: dict[int, float] | None = None,
) -> TransitionResult:
    """All players fully charged → DEBIT GEMS atomically + roll M + compute shares.

    ``weights_map`` (injected by the consumer from SpinnerConfig.coop_base_weights)
    sets the multiplier odds; defaults to the legacy 1/(v+1) formula. Kept as a
    param so this transition stays pure (no DB access).

    Emits room.spinning. Schedules a SPINNING → REVEAL timer."""
    if room.phase != Phase.CHARGING:
        raise TransitionError(
            ErrorCode.INVALID_STATE, f"cannot complete charging in {room.phase.value}"
        )
    if not room.all_charged():
        raise TransitionError(
            ErrorCode.INVALID_STATE, "not all players are fully charged"
        )

    stakes = [
        PlayerStake(user_id=p.user_id, seat=p.seat, stake=p.stake)
        for p in room.players
    ]
    result: RoundResult = compute_round(stakes, rng=rng, weights_map=weights_map)
    round_id = str(uuid.uuid4())

    debit_payload = {p.user_id: p.stake for p in room.players}

    shares_serialized = tuple(
        {
            "user_id": s.user_id,
            "seat": s.seat,
            "stake": s.stake,
            "floor": s.floor,
            "excess": s.excess,
            "share": s.share,
        }
        for s in result.shares
    )

    new_room = room.with_changes(
        phase=Phase.SPINNING,
        spinning_started_at_ms=now_ms,
        round_id=round_id,
        round_M=result.M,
        round_shares=shares_serialized,
    )
    new_room, event = _emit(
        new_room,
        "room.spinning",
        {
            "round_id": round_id,
            "spin_duration_ms": SPINNING_DURATION_MS,
            "debited": debit_payload,
            "state": new_room.phase.value,
        },
    )
    side_effects = (
        SideEffect(SideEffectKind.DEBIT_GEMS, {"debits": debit_payload, "round_id": round_id}),
        SideEffect(
            SideEffectKind.SCHEDULE_TIMER,
            {
                "kind": "spin_complete",
                "fire_at_ms": now_ms + SPINNING_DURATION_MS,
                "room_id": new_room.room_id,
            },
        ),
    )
    return TransitionResult(room=new_room, events=(event,), side_effects=side_effects)


def complete_spinning(room: Room, *, now_ms: int) -> TransitionResult:
    """Timer-triggered: SPINNING → REVEAL. Emits the authoritative outcome."""
    if room.phase != Phase.SPINNING:
        return TransitionResult(room=room)
    if room.round_id is None or room.round_M is None or room.round_shares is None:
        raise TransitionError(
            ErrorCode.INTERNAL, "complete_spinning called without precomputed round"
        )

    new_room = room.with_changes(
        phase=Phase.REVEAL, reveal_started_at_ms=now_ms, reveal_acks=frozenset()
    )

    G = room.gems_total()
    f = floor_multiplier(G, room.num_players())
    new_room, event = _emit(
        new_room,
        "room.reveal",
        {
            "round_id": room.round_id,
            "M": room.round_M,
            "G_total": G,
            "f": f,
            "total_payout": G * room.round_M,
            "shares": list(room.round_shares),
            "reveal_plan": {
                "phases": [
                    {"phase": "total", "duration_ms": 600, "payload": {"total_payout": G * room.round_M}},
                    {"phase": "floor", "duration_ms": 800, "payload": {"shares": list(room.round_shares)}},
                    {"phase": "excess", "duration_ms": 1200, "payload": {"shares": list(room.round_shares)}},
                ]
            },
            "state": new_room.phase.value,
        },
    )
    side_effects = (
        SideEffect(
            SideEffectKind.SCHEDULE_TIMER,
            {
                "kind": "reveal_timeout",
                "fire_at_ms": now_ms + REVEAL_TIMEOUT_MS,
                "room_id": new_room.room_id,
            },
        ),
    )
    return TransitionResult(room=new_room, events=(event,), side_effects=side_effects)


def ack_reveal(
    room: Room, *, user_id: str, round_id: str, now_ms: int
) -> TransitionResult:
    """Client confirms it has played the reveal animation. When all clients ack
    OR the timeout fires, the room transitions to SETTLED."""
    if room.phase != Phase.REVEAL:
        # Late ack; ignore silently rather than error
        return TransitionResult(room=room)
    if round_id != room.round_id:
        raise TransitionError(ErrorCode.INVALID_STATE, "stale round_id")
    _require_player(room, user_id)

    new_acks = room.reveal_acks | {user_id}
    new_room = room.with_changes(reveal_acks=new_acks)

    expected = {p.user_id for p in room.players if p.connected}
    if new_acks >= expected:
        return _to_settled(new_room, now_ms=now_ms)
    return TransitionResult(room=new_room)


def reveal_timeout(room: Room, *, now_ms: int) -> TransitionResult:
    """Timer-triggered fallback: force REVEAL → SETTLED if not all clients acked."""
    if room.phase != Phase.REVEAL:
        return TransitionResult(room=room)
    return _to_settled(room, now_ms=now_ms)


def _to_settled(room: Room, *, now_ms: int) -> TransitionResult:
    if room.round_shares is None:
        raise TransitionError(ErrorCode.INTERNAL, "to_settled without shares")

    credits = {s["user_id"]: s["share"] for s in room.round_shares}
    new_room = room.with_changes(phase=Phase.SETTLED)
    new_room, event = _emit(
        new_room,
        "room.settled",
        {
            "round_id": room.round_id,
            "credited": credits,
            "state": new_room.phase.value,
        },
    )
    side_effects = (
        SideEffect(
            SideEffectKind.CREDIT_COUPOINTS,
            {"credits": credits, "round_id": room.round_id},
        ),
        SideEffect(
            SideEffectKind.PERSIST_ROUND,
            {
                # H-3: pass f and G_total explicitly so the executor doesn't
                # reconstruct them by integer-dividing share[0].
                "round_id": room.round_id,
                "M": room.round_M,
                "f": floor_multiplier(room.gems_total(), room.num_players()),
                "G_total": room.gems_total(),
                "P": room.num_players(),
                "room_id": room.room_id,
                "shares": list(room.round_shares),
            },
        ),
    )
    return TransitionResult(room=new_room, events=(event,), side_effects=side_effects)


# ---------------------------------------------------------------------------
# Abort / refund (drop-off matrix end-state for high-risk phases)
# ---------------------------------------------------------------------------

def _abort_refund(
    room: Room, *, reason: str, now_ms: int
) -> TransitionResult:
    """Cancel the round. Refund any debited gems if we're past CHARGING."""
    refunds: dict[str, int] = {}
    if room.phase == Phase.SPINNING:
        # Gems were debited at CHARGING→SPINNING; refund them
        refunds = {p.user_id: p.stake for p in room.players}

    new_room = room.with_changes(phase=Phase.ABORTED)
    new_room, event = _emit(
        new_room,
        "room.aborted",
        {
            "round_id": room.round_id,
            "reason": reason,
            "refunded": refunds,
            "state": Phase.DISPOSED.value,
        },
    )
    side_effects: tuple[SideEffect, ...] = ()
    if refunds:
        side_effects = side_effects + (
            SideEffect(
                SideEffectKind.REFUND_GEMS,
                {"refunds": refunds, "round_id": room.round_id},
            ),
        )
    side_effects = side_effects + (
        SideEffect(SideEffectKind.DISPOSE_ROOM, {"room_id": new_room.room_id}),
    )
    new_room = new_room.with_changes(phase=Phase.DISPOSED)
    return TransitionResult(room=new_room, events=(event,), side_effects=side_effects)


# ---------------------------------------------------------------------------
# Rematch
# ---------------------------------------------------------------------------

def request_rematch(
    room: Room, *, user_id: str, now_ms: int
) -> TransitionResult:
    """Any settled player can trigger a new round in the same room. Drops connected
    players back to STAKING with stakes reset to 1, locks cleared, charges zeroed."""
    _require_phase(room, Phase.SETTLED)
    _require_player(room, user_id)

    # Drop players who are still in grace but disconnected
    keep = tuple(p for p in room.players if p.connected)
    if not keep:
        # Should not happen; safeguard
        new_room = room.with_changes(phase=Phase.DISPOSED)
        new_room, event = _emit(
            new_room,
            "room.aborted",
            {
                "round_id": None,
                "reason": "system_error",
                "refunded": {},
                "state": Phase.DISPOSED.value,
            },
        )
        return TransitionResult(
            room=new_room,
            events=(event,),
            side_effects=(SideEffect(SideEffectKind.DISPOSE_ROOM, {"room_id": new_room.room_id}),),
        )

    reset = tuple(
        p.with_changes(
            stake=1,
            locked=False,
            charge=0.0,
            is_charging=False,
            charge_started_at_ms=None,
        )
        for p in keep
    )
    new_room = room.with_changes(
        phase=Phase.STAKING,
        players=reset,
        countdown_started_at_ms=None,
        charging_started_at_ms=None,
        spinning_started_at_ms=None,
        reveal_started_at_ms=None,
        reveal_acks=frozenset(),
        round_id=None,
        round_M=None,
        round_shares=None,
    )
    new_room, event = _emit(
        new_room, "room.staked", _build_staked_payload(new_room)
    )
    return TransitionResult(room=new_room, events=(event,))


# ---------------------------------------------------------------------------
# Re-entry (for REVEAL/SETTLED grace)
# ---------------------------------------------------------------------------

def reconnect_player(
    room: Room, *, user_id: str, now_ms: int
) -> TransitionResult:
    """Disconnected player rejoins within grace window."""
    player = _require_player(room, user_id)
    if player.connected:
        return TransitionResult(room=room)
    if player.grace_until_ms is not None and now_ms > player.grace_until_ms:
        # Grace expired; treat as fresh exit
        return _handle_player_exit(room, user_id, reason="grace_expired", now_ms=now_ms)

    new_player = player.with_changes(connected=True, grace_until_ms=None)
    new_room = room.replace_player(user_id, new_player)
    new_room, event = _emit(
        new_room,
        "room.joined",
        {
            "player": new_player.to_dict(),
            "players": [p.to_dict() for p in new_room.players],
            "state": new_room.phase.value,
        },
    )
    return TransitionResult(room=new_room, events=(event,))
