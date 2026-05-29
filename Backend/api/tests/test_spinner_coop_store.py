"""Tests for RoomStore."""

from __future__ import annotations

import threading

import pytest

from api.spinner_coop.room import Player, Room
from api.spinner_coop.states import LOBBY_TTL_MS, Phase
from api.spinner_coop.store import RoomStore


def _room(rid: str = "r1", code: str = "ABCDEF", phase: Phase = Phase.LOBBY_OPEN, expires: int = 1000):
    return Room(
        room_id=rid,
        code=code,
        host_id="alice",
        phase=phase,
        players=(Player(user_id="alice", seat=0, display_name="Alice"),),
        seq=0,
        created_at_ms=0,
        expires_at_ms=expires,
    )


class TestBasicOps:
    def test_put_and_get(self):
        s = RoomStore()
        r = _room()
        s.put(r)
        assert s.get("r1") is r
        assert s.get_by_code("ABCDEF") is r
        assert "r1" in s
        assert len(s) == 1

    def test_get_unknown(self):
        s = RoomStore()
        assert s.get("nope") is None
        assert s.get_by_code("NOPE") is None

    def test_get_by_code_normalizes(self):
        s = RoomStore()
        s.put(_room(code="ABCDEF"))
        assert s.get_by_code("abcdef") is not None
        assert s.get_by_code(" abcdef ") is not None

    def test_remove(self):
        s = RoomStore()
        s.put(_room())
        s.remove("r1")
        assert s.get("r1") is None
        assert s.get_by_code("ABCDEF") is None
        # Idempotent
        s.remove("r1")

    def test_replace_room(self):
        s = RoomStore()
        s.put(_room())
        # Same code, same id, updated state — overwrite OK
        updated = _room().with_changes(seq=5)
        s.put(updated)
        assert s.get("r1").seq == 5

    def test_code_collision_rejected(self):
        s = RoomStore()
        s.put(_room(rid="r1", code="ABCDEF"))
        with pytest.raises(ValueError, match="already bound"):
            s.put(_room(rid="r2", code="ABCDEF"))

    def test_all_rooms(self):
        s = RoomStore()
        s.put(_room("r1", "AAAAAA"))
        s.put(_room("r2", "BBBBBB"))
        assert len(s.all_rooms()) == 2

    def test_clear(self):
        s = RoomStore()
        s.put(_room())
        s.clear()
        assert len(s) == 0


class TestExpiry:
    def test_expire_lobby_removes_expired(self):
        s = RoomStore()
        s.put(_room("r1", "AAAAAA", phase=Phase.LOBBY_OPEN, expires=1000))
        s.put(_room("r2", "BBBBBB", phase=Phase.LOBBY_OPEN, expires=5000))
        expired = s.expire_lobby(now_ms=2000)
        assert expired == ("r1",)
        assert s.get("r1") is None
        assert s.get("r2") is not None

    def test_expire_lobby_skips_non_lobby_phases(self):
        s = RoomStore()
        s.put(_room("r1", "AAAAAA", phase=Phase.READY, expires=0))
        s.put(_room("r2", "BBBBBB", phase=Phase.SPINNING, expires=0))
        expired = s.expire_lobby(now_ms=10_000)
        assert expired == ()
        assert len(s) == 2

    def test_expire_includes_staking(self):
        # STAKING is also joinable; it should also expire if past TTL
        s = RoomStore()
        s.put(_room("r1", "AAAAAA", phase=Phase.STAKING, expires=0))
        expired = s.expire_lobby(now_ms=10_000)
        assert expired == ("r1",)


class TestThreadSafety:
    def test_concurrent_put_and_get(self):
        s = RoomStore()
        # Use letters only to stay within the code alphabet and ensure uniqueness.
        n = 50  # 26*26 fits easily
        rooms = []
        for i in range(n):
            a = chr(ord("A") + i // 26)
            b = chr(ord("A") + i % 26)
            rooms.append(_room(rid=f"r{i}", code=f"AAAA{a}{b}"))

        def writer():
            for r in rooms:
                s.put(r)

        def reader():
            for r in rooms:
                _ = s.get(r.room_id)

        threads = [threading.Thread(target=writer) for _ in range(2)] + [
            threading.Thread(target=reader) for _ in range(4)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)
        assert len(s) == n
