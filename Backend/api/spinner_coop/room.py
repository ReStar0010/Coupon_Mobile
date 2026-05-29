"""
Room and Player dataclasses.

Pure data + read-only helpers. Mutating operations live in transitions.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any

from .states import Phase


@dataclass(frozen=True)
class Player:
    """Per-player state inside a room."""

    user_id: str
    seat: int
    display_name: str
    avatar_url: str | None = None

    # Staking
    stake: int = 1
    locked: bool = False

    # Charging
    charge: float = 0.0  # [0..1]
    is_charging: bool = False
    charge_started_at_ms: int | None = None

    # Connectivity
    connected: bool = True
    grace_until_ms: int | None = None  # when REENTRY_GRACE expires

    def with_changes(self, **kwargs: Any) -> "Player":
        return replace(self, **kwargs)

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "seat": self.seat,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "stake": self.stake,
            "locked": self.locked,
            "progress": round(self.charge, 4),
            "is_charging": self.is_charging,
            "connected": self.connected,
        }


@dataclass(frozen=True)
class Room:
    """A single co-op room. Frozen: every mutation produces a new Room via .with_changes()."""

    room_id: str
    code: str
    host_id: str
    phase: Phase
    players: tuple[Player, ...]

    # Bookkeeping
    seq: int = 0  # monotonic per-room event seq; incremented by transitions before emit
    created_at_ms: int = 0
    expires_at_ms: int = 0  # lobby TTL

    # Phase timers (epoch ms; None when not in that phase)
    countdown_started_at_ms: int | None = None
    charging_started_at_ms: int | None = None
    spinning_started_at_ms: int | None = None
    reveal_started_at_ms: int | None = None

    # Round outcome (populated at SPINNING; carried through REVEAL/SETTLED)
    round_id: str | None = None
    round_M: int | None = None
    round_shares: tuple[dict, ...] | None = None  # serialized shares for emission
    reveal_acks: frozenset[str] = field(default_factory=frozenset)

    # H-4 fix: solo rooms refuse joiners regardless of phase. Set at create.
    is_solo: bool = False

    # ── Read-only helpers ──────────────────────────────────────────────────

    def with_changes(self, **kwargs: Any) -> "Room":
        return replace(self, **kwargs)

    def with_players(self, players: tuple[Player, ...]) -> "Room":
        return replace(self, players=players)

    def increment_seq(self) -> "Room":
        return replace(self, seq=self.seq + 1)

    def gems_total(self) -> int:
        return sum(p.stake for p in self.players)

    def num_players(self) -> int:
        return len(self.players)

    def all_locked(self) -> bool:
        return bool(self.players) and all(p.locked for p in self.players)

    def all_charged(self) -> bool:
        return bool(self.players) and all(p.charge >= 1.0 for p in self.players)

    def find_player(self, user_id: str) -> Player | None:
        for p in self.players:
            if p.user_id == user_id:
                return p
        return None

    def find_player_index(self, user_id: str) -> int | None:
        for i, p in enumerate(self.players):
            if p.user_id == user_id:
                return i
        return None

    def replace_player(self, user_id: str, new_player: Player) -> "Room":
        idx = self.find_player_index(user_id)
        if idx is None:
            raise KeyError(f"player {user_id} not in room {self.room_id}")
        new_players = self.players[:idx] + (new_player,) + self.players[idx + 1 :]
        return self.with_players(new_players)

    def remove_player(self, user_id: str) -> "Room":
        new_players = tuple(p for p in self.players if p.user_id != user_id)
        return self.with_players(new_players)

    def add_player(self, player: Player) -> "Room":
        return self.with_players(self.players + (player,))

    def next_free_seat(self) -> int:
        used = {p.seat for p in self.players}
        for i in range(3):
            if i not in used:
                return i
        raise RuntimeError("no free seat (room is full)")

    def is_host(self, user_id: str) -> bool:
        return self.host_id == user_id

    def to_snapshot_dict(self) -> dict:
        """Player-list snapshot used in many event payloads."""
        return {
            "room_id": self.room_id,
            "code": self.code,
            "host_id": self.host_id,
            "phase": self.phase.value,
            "players": [p.to_dict() for p in self.players],
            "G_total": self.gems_total(),
            "P": self.num_players(),
        }
