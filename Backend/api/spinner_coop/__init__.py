"""
Spinner Co-op — multiplayer room state machine.

Pure-Python implementation of the state graph defined in
specs/spinner-coop/state-machine-and-events.md.

Submodules:
    states       — Phase enum, error codes, side-effect kinds
    room         — Room and Player dataclasses + helpers
    events       — Event / SideEffect / TransitionResult value types
    codes        — short-code generator
    transitions  — every state transition as a pure function
    store        — thread-safe in-memory RoomStore

Deliverable 3b will wrap these primitives in a Channels WS consumer + ASGI
routing + persistence layer.
"""

from .states import Phase, ErrorCode, SideEffectKind
from .room import Room, Player
from .events import Event, SideEffect, TransitionResult, TransitionError
from .store import RoomStore

__all__ = [
    "Phase",
    "ErrorCode",
    "SideEffectKind",
    "Room",
    "Player",
    "Event",
    "SideEffect",
    "TransitionResult",
    "TransitionError",
    "RoomStore",
]
