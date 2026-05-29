"""SideEffectExecutor — wallet + ledger + scheduler dispatch."""

from __future__ import annotations

import pytest
from django.contrib.auth.models import User

from api.spinner_coop.events import SideEffect
from api.spinner_coop.executor import SideEffectExecutor
from api.spinner_coop.models import SpinnerRound, Wallet
from api.spinner_coop.states import SideEffectKind


pytestmark = pytest.mark.django_db


class FakeScheduler:
    def __init__(self):
        self.scheduled: list[tuple[str, str, int]] = []
        self.cancelled: list[tuple[str, str]] = []
        self.disposed: list[str] = []

    def schedule(self, room_id: str, kind: str, fire_at_ms: int) -> None:
        self.scheduled.append((room_id, kind, fire_at_ms))

    def cancel(self, room_id: str, kind: str) -> None:
        self.cancelled.append((room_id, kind))

    def dispose(self, room_id: str) -> None:
        self.disposed.append(room_id)


@pytest.fixture
def users():
    a = User.objects.create_user(username="alice", password="x")
    b = User.objects.create_user(username="bob", password="x")
    Wallet.objects.create(user=a, gems=10, cou_points=0)
    Wallet.objects.create(user=b, gems=5, cou_points=0)
    return a, b


class TestDispatch:
    def test_debit_then_credit_in_one_atomic(self, users):
        a, b = users
        sched = FakeScheduler()
        executor = SideEffectExecutor(scheduler=sched)
        executor.execute_all([
            SideEffect(SideEffectKind.DEBIT_GEMS, {"debits": {a.id: 3, b.id: 2}, "round_id": "r"}),
            SideEffect(SideEffectKind.CREDIT_COUPOINTS, {"credits": {a.id: 7, b.id: 8}, "round_id": "r"}),
        ])
        assert Wallet.objects.get(user=a).gems == 7
        assert Wallet.objects.get(user=a).cou_points == 7
        assert Wallet.objects.get(user=b).gems == 3
        assert Wallet.objects.get(user=b).cou_points == 8

    def test_persist_round_writes_ledger(self, users):
        a, b = users
        sched = FakeScheduler()
        executor = SideEffectExecutor(scheduler=sched)
        round_id = "00000000-0000-0000-0000-000000000001"
        executor.execute_all([
            SideEffect(
                SideEffectKind.PERSIST_ROUND,
                {
                    "round_id": round_id,
                    "M": 4,
                    "shares": [
                        {"user_id": str(a.id), "seat": 0, "stake": 3, "floor": 6, "excess": 4, "share": 10},
                        {"user_id": str(b.id), "seat": 1, "stake": 2, "floor": 4, "excess": 6, "share": 10},
                    ],
                },
            ),
        ])
        row = SpinnerRound.objects.get(round_id=round_id)
        assert row.m_multiplier == 4
        assert row.num_players == 2
        assert row.g_total == 5
        assert row.f_floor == 2  # floor / stake = 6/3 = 2
        assert row.aborted is False

    def test_refund_kind(self, users):
        a, b = users
        executor = SideEffectExecutor(scheduler=FakeScheduler())
        executor.execute_all([
            SideEffect(SideEffectKind.REFUND_GEMS, {"refunds": {a.id: 1, b.id: 2}, "round_id": "r"}),
        ])
        assert Wallet.objects.get(user=a).gems == 11
        assert Wallet.objects.get(user=b).gems == 7

    def test_scheduler_effects_dispatched(self, users):
        sched = FakeScheduler()
        executor = SideEffectExecutor(scheduler=sched)
        executor.execute_all([
            SideEffect(SideEffectKind.SCHEDULE_TIMER, {"room_id": "r1", "kind": "auto_countdown", "fire_at_ms": 100}),
            SideEffect(SideEffectKind.CANCEL_TIMER, {"room_id": "r1", "kind": "auto_countdown"}),
            SideEffect(SideEffectKind.DISPOSE_ROOM, {"room_id": "r1"}),
        ])
        assert sched.scheduled == [("r1", "auto_countdown", 100)]
        assert sched.cancelled == [("r1", "auto_countdown")]
        assert sched.disposed == ["r1"]

    def test_wallet_atomicity_rolls_back_ledger_too(self, users):
        """If the debit fails (insufficient), the ledger row should not be written."""
        a, b = users
        sched = FakeScheduler()
        executor = SideEffectExecutor(scheduler=sched)
        round_id = "00000000-0000-0000-0000-000000000002"
        from api.spinner_coop.wallet_service import InsufficientGemsError

        with pytest.raises(InsufficientGemsError):
            executor.execute_all([
                # b has only 5; debit 99 → fails
                SideEffect(SideEffectKind.DEBIT_GEMS, {"debits": {b.id: 99}, "round_id": round_id}),
                SideEffect(
                    SideEffectKind.PERSIST_ROUND,
                    {
                        "round_id": round_id,
                        "M": 1,
                        "shares": [
                            {"user_id": str(b.id), "seat": 0, "stake": 1, "floor": 1, "excess": 0, "share": 1},
                        ],
                    },
                ),
            ])
        # Ledger should NOT have the row
        assert not SpinnerRound.objects.filter(round_id=round_id).exists()
        # Wallet untouched
        assert Wallet.objects.get(user=b).gems == 5
