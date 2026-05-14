"""
Value types returned by every transition.

A transition either:
  - returns a TransitionResult(new_room, events, side_effects), OR
  - raises a TransitionError(code, message).

The WS consumer (3b) is responsible for:
  - Persisting `new_room` (replacing the prior version in the store)
  - Broadcasting `events` to all connected players in that room (after stamping
    envelope: v, ts, seq, room_id)
  - Executing `side_effects` against the DB / scheduler
  - Translating TransitionError into an `error` frame to the offending client
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .states import ErrorCode, SideEffectKind


@dataclass(frozen=True)
class Event:
    """Server-emitted event. The seq is assigned by the transition; the rest of the
    envelope (v, ts, room_id) is stamped by the broadcast layer in 3b."""

    type: str  # e.g. "room.created", "room.staked", "room.reveal"
    body: dict
    seq: int

    def to_envelope(self, room_id: str, ts_ms: int, version: int = 1) -> dict:
        return {
            "v": version,
            "type": self.type,
            "ts": ts_ms,
            "seq": self.seq,
            "room_id": room_id,
            "body": self.body,
        }


@dataclass(frozen=True)
class SideEffect:
    """An action 3b must perform against an external system."""

    kind: SideEffectKind
    payload: dict


@dataclass(frozen=True)
class TransitionResult:
    """Output of every successful transition."""

    room: object  # Room (avoid circular import here; runtime type is room.Room)
    events: tuple[Event, ...] = ()
    side_effects: tuple[SideEffect, ...] = ()

    def with_event(self, event: Event) -> "TransitionResult":
        return TransitionResult(
            room=self.room,
            events=self.events + (event,),
            side_effects=self.side_effects,
        )

    def with_side_effect(self, eff: SideEffect) -> "TransitionResult":
        return TransitionResult(
            room=self.room,
            events=self.events,
            side_effects=self.side_effects + (eff,),
        )


class TransitionError(Exception):
    """Raised when a command is rejected. Maps onto the `error` server frame in spec §3.5."""

    def __init__(self, code: ErrorCode, message: str = ""):
        self.code = code
        self.message = message or code.value
        super().__init__(f"{code.value}: {self.message}")
