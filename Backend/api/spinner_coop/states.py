"""
Phase enum, error codes, and side-effect kinds.

Mirrors specs/spinner-coop/state-machine-and-events.md §2.1, §3.5.
"""

from __future__ import annotations

from enum import Enum


class Phase(str, Enum):
    """Room-level state. See spec §2.1."""

    SOLO = "SOLO"
    LOBBY_OPEN = "LOBBY_OPEN"
    STAKING = "STAKING"
    READY = "READY"
    COUNTDOWN = "COUNTDOWN"
    CHARGING = "CHARGING"
    SPINNING = "SPINNING"
    REVEAL = "REVEAL"
    SETTLED = "SETTLED"
    ABORTED = "ABORTED"
    DISPOSED = "DISPOSED"


# Phases in which a player's connection drop triggers an abort+refund.
ABORT_ON_DISCONNECT_PHASES: frozenset[Phase] = frozenset(
    {Phase.READY, Phase.COUNTDOWN, Phase.CHARGING, Phase.SPINNING}
)

# Phases in which the room is interactive (commands accepted from clients).
TERMINAL_PHASES: frozenset[Phase] = frozenset({Phase.ABORTED, Phase.DISPOSED})

# Phases in which a new joiner is accepted (free-slot policy).
JOINABLE_PHASES: frozenset[Phase] = frozenset({Phase.LOBBY_OPEN, Phase.STAKING})


class ErrorCode(str, Enum):
    """See spec §3.5."""

    INVALID_STATE = "INVALID_STATE"
    FORBIDDEN = "FORBIDDEN"
    ROOM_FULL = "ROOM_FULL"
    ROOM_EXPIRED = "ROOM_EXPIRED"
    ROOM_NOT_FOUND = "ROOM_NOT_FOUND"
    STAKE_OUT_OF_RANGE = "STAKE_OUT_OF_RANGE"
    INSUFFICIENT_GEMS = "INSUFFICIENT_GEMS"
    RATE_LIMIT = "RATE_LIMIT"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    ALREADY_IN_ROOM = "ALREADY_IN_ROOM"
    INTERNAL = "INTERNAL"


class SideEffectKind(str, Enum):
    """Actions deliverable 3b must execute against external systems (DB, scheduler)."""

    DEBIT_GEMS = "DEBIT_GEMS"  # payload: {user_id: gems}
    REFUND_GEMS = "REFUND_GEMS"  # payload: {user_id: gems}
    CREDIT_COUPOINTS = "CREDIT_COUPOINTS"  # payload: {user_id: coupoints}
    PERSIST_ROUND = "PERSIST_ROUND"  # payload: round dict
    SCHEDULE_TIMER = "SCHEDULE_TIMER"  # payload: {kind, fire_at_ms}
    CANCEL_TIMER = "CANCEL_TIMER"  # payload: {kind}
    DISPOSE_ROOM = "DISPOSE_ROOM"  # payload: {}


# Locked from spec §3 / §1
LOBBY_TTL_MS: int = 60_000
COUNTDOWN_DURATION_MS: int = 3_000
COUNTDOWN_AUTO_START_MS: int = 2_000
CHARGING_DURATION_MS: int = 2_500
SPINNING_DURATION_MS: int = 1_500
REVEAL_TIMEOUT_MS: int = 8_000
REENTRY_GRACE_MS: int = 30_000
CHARGE_BROADCAST_HZ: int = 10  # 100ms cadence
PING_INTERVAL_MS: int = 15_000
PONG_TIMEOUT_MS: int = 5_000
MAX_PLAYERS: int = 3
PROTOCOL_VERSION: int = 1
