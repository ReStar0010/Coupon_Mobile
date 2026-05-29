"""
Thread-safe in-memory room store.

For deliverable 3a only. Deliverable 3b will swap (or wrap) this in a
Redis-backed implementation behind the same interface so multi-worker
deployments don't lose room state on a process boundary.

Interface kept minimal:
    get(room_id), get_by_code(code), put(room), remove(room_id),
    expire_lobby(now_ms), all_rooms()
"""

from __future__ import annotations

import threading

from .codes import normalize as normalize_code
from .room import Room
from .states import JOINABLE_PHASES, Phase


class RoomStore:
    """Thread-safe room registry.

    Two indexes:
      - by room_id (canonical lookup)
      - by code (uppercase canonical) for player joins

    Both indexes are kept in sync under a single RLock.
    """

    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}
        self._codes: dict[str, str] = {}  # code -> room_id
        self._lock = threading.RLock()

    # ── Reads ──────────────────────────────────────────────────────────────

    def get(self, room_id: str) -> Room | None:
        with self._lock:
            return self._rooms.get(room_id)

    def get_by_code(self, code: str) -> Room | None:
        norm = normalize_code(code)
        with self._lock:
            room_id = self._codes.get(norm)
            if room_id is None:
                return None
            return self._rooms.get(room_id)

    def all_rooms(self) -> tuple[Room, ...]:
        with self._lock:
            return tuple(self._rooms.values())

    def __len__(self) -> int:
        with self._lock:
            return len(self._rooms)

    def __contains__(self, room_id: str) -> bool:
        with self._lock:
            return room_id in self._rooms

    # ── Writes ─────────────────────────────────────────────────────────────

    def put(self, room: Room) -> None:
        """Insert or replace. Callers MUST pass the latest Room produced by a
        transition (since Room is frozen). Raises if the code conflicts with a
        different existing room."""
        with self._lock:
            existing = self._codes.get(room.code)
            if existing is not None and existing != room.room_id:
                raise ValueError(
                    f"code {room.code!r} already bound to room {existing}"
                )
            # Detect renamed-code edge case: if updating a room whose code changed,
            # remove the old code mapping. (We don't currently change codes, but
            # this future-proofs the store.)
            prior = self._rooms.get(room.room_id)
            if prior is not None and prior.code != room.code:
                self._codes.pop(prior.code, None)
            self._rooms[room.room_id] = room
            self._codes[room.code] = room.room_id

    def remove(self, room_id: str) -> None:
        """Remove a room (e.g. on DISPOSE side effect). Idempotent."""
        with self._lock:
            room = self._rooms.pop(room_id, None)
            if room is not None:
                self._codes.pop(room.code, None)

    # ── Maintenance ────────────────────────────────────────────────────────

    def expire_lobby(self, now_ms: int) -> tuple[str, ...]:
        """Remove lobby-phase rooms past their TTL. Returns the removed room_ids
        so the caller can broadcast a final room.aborted to any stragglers."""
        expired: list[str] = []
        with self._lock:
            for room in list(self._rooms.values()):
                if (
                    room.phase in JOINABLE_PHASES
                    and now_ms >= room.expires_at_ms
                ):
                    expired.append(room.room_id)
            for rid in expired:
                room = self._rooms.pop(rid, None)
                if room is not None:
                    self._codes.pop(room.code, None)
        return tuple(expired)

    def clear(self) -> None:
        """Test helper. Drop everything."""
        with self._lock:
            self._rooms.clear()
            self._codes.clear()
