"""Tests for Room and Player dataclasses."""

from __future__ import annotations

import pytest

from api.spinner_coop.room import Player, Room
from api.spinner_coop.states import Phase


def _player(uid: str, seat: int = 0, **kwargs) -> Player:
    return Player(user_id=uid, seat=seat, display_name=uid, **kwargs)


def _room(*, phase: Phase = Phase.STAKING, players: tuple[Player, ...] | None = None) -> Room:
    if players is None:
        players = (_player("a", 0),)
    host_id = players[0].user_id if players else "ghost-host"
    return Room(
        room_id="rid",
        code="ABCDEF",
        host_id=host_id,
        phase=phase,
        players=players,
        seq=0,
    )


class TestPlayerHelpers:
    def test_with_changes_returns_new_player(self):
        p = _player("a", stake=2)
        p2 = p.with_changes(stake=5, locked=True)
        assert p.stake == 2 and not p.locked
        assert p2.stake == 5 and p2.locked

    def test_to_dict(self):
        d = _player("a", seat=1, stake=3, locked=True).to_dict()
        assert d["user_id"] == "a"
        assert d["seat"] == 1
        assert d["stake"] == 3
        assert d["locked"] is True
        assert "progress" in d


class TestRoomHelpers:
    def test_immutable_with_changes(self):
        r = _room()
        r2 = r.with_changes(phase=Phase.READY)
        assert r.phase == Phase.STAKING
        assert r2.phase == Phase.READY

    def test_increment_seq(self):
        r = _room()
        assert r.seq == 0
        r2 = r.increment_seq()
        assert r2.seq == 1
        # original untouched
        assert r.seq == 0

    def test_gems_total_and_num_players(self):
        r = _room(players=(
            _player("a", 0, stake=3),
            _player("b", 1, stake=2),
            _player("c", 2, stake=1),
        ))
        assert r.gems_total() == 6
        assert r.num_players() == 3

    def test_all_locked(self):
        r = _room(players=(
            _player("a", 0, locked=True),
            _player("b", 1, locked=False),
        ))
        assert not r.all_locked()
        r2 = r.with_players((_player("a", 0, locked=True), _player("b", 1, locked=True)))
        assert r2.all_locked()

    def test_all_locked_empty_room(self):
        r = _room(players=())
        assert not r.all_locked()

    def test_all_charged(self):
        r = _room(players=(
            _player("a", 0, charge=1.0),
            _player("b", 1, charge=0.99),
        ))
        assert not r.all_charged()
        r2 = r.with_players((
            _player("a", 0, charge=1.0),
            _player("b", 1, charge=1.0),
        ))
        assert r2.all_charged()

    def test_find_and_replace_player(self):
        r = _room(players=(_player("a"), _player("b", seat=1)))
        assert r.find_player("a").seat == 0
        assert r.find_player("zzz") is None
        r2 = r.replace_player("a", _player("a", seat=0, stake=5))
        assert r2.find_player("a").stake == 5
        # original untouched
        assert r.find_player("a").stake == 1

    def test_replace_unknown_player_raises(self):
        r = _room()
        with pytest.raises(KeyError):
            r.replace_player("ghost", _player("ghost"))

    def test_remove_and_add_player(self):
        r = _room(players=(_player("a"), _player("b", seat=1)))
        r2 = r.remove_player("a")
        assert r2.num_players() == 1
        r3 = r2.add_player(_player("c", seat=2))
        assert r3.num_players() == 2

    def test_next_free_seat(self):
        r = _room(players=(_player("a", seat=0), _player("c", seat=2)))
        assert r.next_free_seat() == 1
        r2 = _room(players=(_player("a", 0), _player("b", 1), _player("c", 2)))
        with pytest.raises(RuntimeError):
            r2.next_free_seat()

    def test_is_host(self):
        r = _room(players=(_player("alice"),))
        assert r.is_host("alice")
        assert not r.is_host("bob")
