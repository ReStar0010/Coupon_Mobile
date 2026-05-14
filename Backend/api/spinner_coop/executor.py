"""
SideEffect dispatcher.

Translates a tuple of SideEffect objects (declared by transitions) into actual
calls against external systems (wallet, ledger, scheduler).

The whole batch is wrapped in a single ``transaction.atomic()`` block so the
SPINNING transition's compound effect (DEBIT_GEMS for every player + a SCHEDULE
side effect) is all-or-nothing for the wallet portion.

Timer side effects (SCHEDULE_TIMER, CANCEL_TIMER, DISPOSE_ROOM) are dispatched
to the scheduler interface passed in by the consumer; they are non-transactional
side effects and run after the DB commit.
"""

from __future__ import annotations

import datetime as dt
import logging
from typing import Iterable, Protocol

from django.db import transaction
from django.utils import timezone

from .events import SideEffect
from .models import SpinnerRound
from .states import SideEffectKind
from .wallet_service import WalletService

log = logging.getLogger(__name__)


class SchedulerProtocol(Protocol):
    """Minimal interface the consumer must satisfy.

    Implementations can be in-process asyncio (deliverable 3b),
    Celery, or RQ. The executor doesn't care.
    """

    def schedule(self, room_id: str, kind: str, fire_at_ms: int) -> None: ...
    def cancel(self, room_id: str, kind: str) -> None: ...
    def dispose(self, room_id: str) -> None: ...


class SideEffectExecutor:
    """Wraps a wallet service and a scheduler. Stateless; safe to share."""

    def __init__(
        self,
        wallet: WalletService | None = None,
        scheduler: SchedulerProtocol | None = None,
    ):
        self.wallet = wallet or WalletService()
        self.scheduler = scheduler

    def execute_all(self, effects: Iterable[SideEffect]) -> None:
        """Run every wallet effect inside a single atomic block, then run
        non-transactional effects (timers, dispose).

        Order matters: DEBIT must happen before PERSIST_ROUND/CREDIT, etc., but
        transitions emit them in the right order so we just iterate.
        """
        wallet_effects: list[SideEffect] = []
        ledger_effects: list[SideEffect] = []
        scheduler_effects: list[SideEffect] = []

        for eff in effects:
            if eff.kind in (
                SideEffectKind.DEBIT_GEMS,
                SideEffectKind.REFUND_GEMS,
                SideEffectKind.CREDIT_COUPOINTS,
            ):
                wallet_effects.append(eff)
            elif eff.kind == SideEffectKind.PERSIST_ROUND:
                ledger_effects.append(eff)
            elif eff.kind in (
                SideEffectKind.SCHEDULE_TIMER,
                SideEffectKind.CANCEL_TIMER,
                SideEffectKind.DISPOSE_ROOM,
            ):
                scheduler_effects.append(eff)
            else:  # pragma: no cover (defensive)
                log.warning("unknown side effect kind: %s", eff.kind)

        # 1) Wallet + ledger inside a single atomic
        if wallet_effects or ledger_effects:
            with transaction.atomic():
                for eff in wallet_effects:
                    self._dispatch_wallet(eff)
                for eff in ledger_effects:
                    self._dispatch_ledger(eff)

        # 2) Scheduler effects (after DB commit so timers don't fire stale state)
        for eff in scheduler_effects:
            self._dispatch_scheduler(eff)

    # ── individual dispatchers ─────────────────────────────────────────────

    def _dispatch_wallet(self, eff: SideEffect) -> None:
        if eff.kind == SideEffectKind.DEBIT_GEMS:
            debits = eff.payload.get("debits", {})
            self.wallet.debit_gems(debits)
        elif eff.kind == SideEffectKind.REFUND_GEMS:
            refunds = eff.payload.get("refunds", {})
            self.wallet.refund_gems(refunds)
        elif eff.kind == SideEffectKind.CREDIT_COUPOINTS:
            credits = eff.payload.get("credits", {})
            self.wallet.credit_coupoints(credits)

    def _dispatch_ledger(self, eff: SideEffect) -> None:
        p = eff.payload
        SpinnerRound.objects.update_or_create(
            round_id=p["round_id"],
            defaults={
                "room_id": p.get("room_id", ""),
                "num_players": len(p.get("shares", [])),
                "g_total": sum(s.get("stake", 0) for s in p.get("shares", [])),
                "f_floor": (
                    p["shares"][0]["floor"] // p["shares"][0]["stake"]
                    if p.get("shares") and p["shares"][0]["stake"] > 0
                    else 0
                ),
                "m_multiplier": p.get("M"),
                "shares": p.get("shares", []),
                "aborted": False,
                "settled_at": timezone.now(),
            },
        )

    def _dispatch_scheduler(self, eff: SideEffect) -> None:
        if self.scheduler is None:
            log.debug(
                "scheduler effect dropped (no scheduler configured): %s", eff.kind
            )
            return
        p = eff.payload
        if eff.kind == SideEffectKind.SCHEDULE_TIMER:
            self.scheduler.schedule(
                room_id=p["room_id"],
                kind=p["kind"],
                fire_at_ms=p["fire_at_ms"],
            )
        elif eff.kind == SideEffectKind.CANCEL_TIMER:
            self.scheduler.cancel(room_id=p["room_id"], kind=p["kind"])
        elif eff.kind == SideEffectKind.DISPOSE_ROOM:
            self.scheduler.dispose(room_id=p["room_id"])
