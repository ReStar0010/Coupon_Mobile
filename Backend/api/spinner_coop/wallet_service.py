"""
Wallet adapter for spinner co-op side effects.

All mutations are wrapped in transaction.atomic + select_for_update so the
SPINNING transition's debit-all-players path is fully atomic: every player's
gem balance moves together, or none does.

Public API (all are WalletService classmethods / staticmethods):
    WalletService.debit_gems({user_id: gems}) -> None
    WalletService.refund_gems({user_id: gems}) -> None
    WalletService.credit_gems({user_id: gems}) -> None
    WalletService.credit_coupoints({user_id: cou_points}) -> None
    WalletService.debit_cou_points({user_id: cou_points}) -> None
    WalletService.mutate(user_id, *, delta_gems, delta_cou_points, kind, ...)
        -> WalletTransaction
    WalletService.get_balance(user_id) -> tuple[gems, cou_points]
    WalletService.ensure_wallet(user_id) -> Wallet  (idempotent)

Errors:
    InsufficientGemsError      — gem debit would take balance below zero.
    InsufficientCouPointsError — cou_points debit would take balance below zero.
    WalletNotFoundError        — user has no wallet row (call ensure_wallet first).

Prefer WalletService.mutate() for any new flow that should appear in the
user's history; the legacy debit_gems / refund_gems / credit_coupoints
helpers are retained for the existing co-op WS consumer's multi-user atomic
block (which writes its own SpinnerRound ledger row).
"""

from __future__ import annotations

import logging
import uuid
from typing import Mapping

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F

from .models import Wallet, WalletTransaction


def _normalize_keys(m: Mapping[int | str, int]) -> dict[int, int]:
    """Coerce string user_ids (emitted by the transitions layer) to int IDs
    (used by the Django auth User PK). Raises ValueError on non-numeric keys."""
    out: dict[int, int] = {}
    for k, v in m.items():
        if isinstance(k, int):
            out[k] = v
        else:
            try:
                out[int(k)] = v
            except (TypeError, ValueError) as exc:
                raise ValueError(f"non-numeric user_id {k!r}") from exc
    return out

log = logging.getLogger(__name__)


# Defensive ceiling for ensure_wallet's starter-grant path. Any caller wanting
# to seed more than this is almost certainly a misconfiguration or attack;
# raise loudly rather than silently mint a huge balance.
_MAX_SEED_GEMS = 1_000


class WalletError(Exception):
    """Base exception for wallet operations."""


class InsufficientGemsError(WalletError):
    def __init__(self, user_id: int, requested: int, balance: int):
        self.user_id = user_id
        self.requested = requested
        self.balance = balance
        super().__init__(
            f"user {user_id} has {balance} gems, cannot debit {requested}"
        )


class InsufficientCouPointsError(WalletError):
    def __init__(self, user_id: int, requested: int, balance: int):
        self.user_id = user_id
        self.requested = requested
        self.balance = balance
        super().__init__(
            f"user {user_id} has {balance} cou_points, cannot debit {requested}"
        )


class WalletNotFoundError(WalletError):
    pass


class WalletService:
    """Sync ORM-backed wallet operations.

    Stateless. Multiple instances are equivalent. Callers should treat each
    method invocation as atomic; chaining multiple methods inside a single
    outer ``transaction.atomic()`` block is supported and recommended for the
    SPINNING transition (debit all players together).
    """

    @staticmethod
    def ensure_wallet(user_id: int, *, initial_gems: int = 0) -> Wallet:
        """Idempotent: creates a wallet row if one doesn't already exist.

        When created with initial_gems > 0, also writes a SEED WalletTransaction
        row so the starter grant shows up in the user's history.

        Raises ValueError if initial_gems is negative or exceeds _MAX_SEED_GEMS.
        """
        if initial_gems < 0:
            raise ValueError(f"initial_gems must be non-negative; got {initial_gems}")
        if initial_gems > _MAX_SEED_GEMS:
            raise ValueError(
                f"initial_gems {initial_gems} exceeds ceiling {_MAX_SEED_GEMS}"
            )
        with transaction.atomic():
            wallet, created = Wallet.objects.get_or_create(
                user_id=user_id,
                defaults={"gems": initial_gems, "cou_points": 0},
            )
            if created and initial_gems > 0:
                WalletTransaction.objects.create(
                    user_id=user_id,
                    kind=WalletTransaction.Kind.SEED,
                    delta_gems=initial_gems,
                    delta_cou_points=0,
                    balance_after_gems=initial_gems,
                    balance_after_cou_points=0,
                    note='Starter gems on wallet creation',
                )
        return wallet

    @staticmethod
    def get_balance(user_id: int) -> tuple[int, int]:
        try:
            w = Wallet.objects.only("gems", "cou_points").get(user_id=user_id)
        except Wallet.DoesNotExist as exc:
            raise WalletNotFoundError(f"no wallet for user {user_id}") from exc
        return (w.gems, w.cou_points)

    @staticmethod
    def debit_gems(debits: Mapping[int | str, int]) -> None:
        """Atomically subtract gems from each user's balance.

        All-or-nothing: if any debit would take a balance below zero, the entire
        operation rolls back and InsufficientGemsError is raised.
        """
        if not debits:
            return
        for amount in debits.values():
            if amount < 0:
                raise ValueError(f"debit amounts must be non-negative; got {amount}")
        debits = _normalize_keys(debits)

        with transaction.atomic():
            wallets = (
                Wallet.objects.select_for_update().filter(user_id__in=list(debits.keys()))
            )
            by_id: dict[int, Wallet] = {w.user_id: w for w in wallets}
            missing = set(debits.keys()) - by_id.keys()
            if missing:
                raise WalletNotFoundError(f"no wallet for users {sorted(missing)}")
            for uid, amount in debits.items():
                w = by_id[uid]
                if w.gems < amount:
                    raise InsufficientGemsError(
                        user_id=uid, requested=amount, balance=w.gems
                    )
                Wallet.objects.filter(user_id=uid).update(
                    gems=F("gems") - amount, version=F("version") + 1
                )
            log.info(
                "spinner_coop.debit_gems",
                extra={"debits": dict(debits)},
            )

    @staticmethod
    def refund_gems(refunds: Mapping[int | str, int]) -> None:
        """Inverse of debit_gems. Always succeeds (additive)."""
        if not refunds:
            return
        for amount in refunds.values():
            if amount < 0:
                raise ValueError(f"refund amounts must be non-negative; got {amount}")
        refunds = _normalize_keys(refunds)
        with transaction.atomic():
            for uid, amount in refunds.items():
                Wallet.objects.filter(user_id=uid).update(
                    gems=F("gems") + amount, version=F("version") + 1
                )
            log.info(
                "spinner_coop.refund_gems", extra={"refunds": dict(refunds)}
            )

    @staticmethod
    def credit_coupoints(credits: Mapping[int | str, int]) -> None:
        """Add CouPoints to each user's balance. Always succeeds.

        NOTE: Unledgered — used by the coop reveal path which writes its own
        SpinnerRound row. For history-visible mutations use mutate() instead.
        """
        if not credits:
            return
        for amount in credits.values():
            if amount < 0:
                raise ValueError(f"credit amounts must be non-negative; got {amount}")
        credits = _normalize_keys(credits)
        with transaction.atomic():
            for uid, amount in credits.items():
                Wallet.objects.filter(user_id=uid).update(
                    cou_points=F("cou_points") + amount, version=F("version") + 1
                )
            log.info(
                "spinner_coop.credit_coupoints", extra={"credits": dict(credits)}
            )

    @staticmethod
    def credit_gems(credits: Mapping[int | str, int]) -> None:
        """Add gems to each user's balance. Always succeeds (additive).

        NOTE: Unledgered. For history-visible reward / seed credits, prefer
        mutate() which writes a WalletTransaction row in the same atomic
        block.
        """
        if not credits:
            return
        for amount in credits.values():
            if amount < 0:
                raise ValueError(f"credit amounts must be non-negative; got {amount}")
        credits = _normalize_keys(credits)
        with transaction.atomic():
            for uid, amount in credits.items():
                updated = Wallet.objects.filter(user_id=uid).update(
                    gems=F("gems") + amount, version=F("version") + 1
                )
                if updated == 0:
                    raise WalletNotFoundError(f"no wallet for user {uid}")
            log.info(
                "spinner_coop.credit_gems", extra={"credits": dict(credits)}
            )

    @staticmethod
    def debit_cou_points(debits: Mapping[int | str, int]) -> None:
        """Subtract CouPoints from each user's balance. All-or-nothing.

        Raises InsufficientCouPointsError if any debit would drop a balance
        below zero — the entire batch rolls back.

        NOTE: Unledgered helper. For history-visible spend operations prefer
        mutate() so a WalletTransaction row records the transaction.
        """
        if not debits:
            return
        for amount in debits.values():
            if amount < 0:
                raise ValueError(f"debit amounts must be non-negative; got {amount}")
        debits = _normalize_keys(debits)

        with transaction.atomic():
            wallets = (
                Wallet.objects.select_for_update().filter(user_id__in=list(debits.keys()))
            )
            by_id: dict[int, Wallet] = {w.user_id: w for w in wallets}
            missing = set(debits.keys()) - by_id.keys()
            if missing:
                raise WalletNotFoundError(f"no wallet for users {sorted(missing)}")
            for uid, amount in debits.items():
                w = by_id[uid]
                if w.cou_points < amount:
                    raise InsufficientCouPointsError(
                        user_id=uid, requested=amount, balance=w.cou_points
                    )
                Wallet.objects.filter(user_id=uid).update(
                    cou_points=F("cou_points") - amount, version=F("version") + 1
                )
            log.info(
                "spinner_coop.debit_cou_points",
                extra={"debits": dict(debits)},
            )

    @classmethod
    def mutate(
        cls,
        user_id: int | str,
        *,
        delta_gems: int = 0,
        delta_cou_points: int = 0,
        kind: str,
        related_round_id: uuid.UUID | None = None,
        related_coupon_id: int | None = None,
        related_store_id: int | None = None,
        note: str = '',
    ) -> WalletTransaction:
        """Single chokepoint for ledger-tracked wallet mutations.

        Wraps the Wallet update and WalletTransaction insert in one
        transaction.atomic block with select_for_update on the Wallet row.
        Returns the persisted WalletTransaction row.

        Use this for every new flow whose effect should appear in the user's
        history (solo spinner, share rewards, coupon redeem credits, CouPoint
        spends, qr-claim grants, etc.).

        Validation:
          * At least one of delta_gems / delta_cou_points must be non-zero.
          * If delta_gems < 0 and resulting balance < 0: InsufficientGemsError.
          * If delta_cou_points < 0 and resulting balance < 0:
            InsufficientCouPointsError.
          * Wallet row must exist (call ensure_wallet first if you're not sure).
        """
        if delta_gems == 0 and delta_cou_points == 0:
            raise ValueError("mutate() requires at least one non-zero delta")
        # Django TextChoices is not enforced at the DB level — Django's choices=
        # is a UI/admin hint only. Guard against typos at the service boundary.
        if kind not in WalletTransaction.Kind.values:
            raise ValueError(f"unknown WalletTransaction kind: {kind!r}")
        uid = user_id if isinstance(user_id, int) else int(user_id)

        with transaction.atomic():
            try:
                wallet = Wallet.objects.select_for_update().get(user_id=uid)
            except Wallet.DoesNotExist as exc:
                raise WalletNotFoundError(f"no wallet for user {uid}") from exc

            # Validate against the pre-update snapshot — the row lock guarantees
            # no concurrent writer can interleave between this check and the
            # F() update below.
            if wallet.gems + delta_gems < 0:
                raise InsufficientGemsError(
                    user_id=uid, requested=-delta_gems, balance=wallet.gems
                )
            if wallet.cou_points + delta_cou_points < 0:
                raise InsufficientCouPointsError(
                    user_id=uid, requested=-delta_cou_points, balance=wallet.cou_points
                )

            Wallet.objects.filter(user_id=uid).update(
                gems=F("gems") + delta_gems,
                cou_points=F("cou_points") + delta_cou_points,
                version=F("version") + 1,
            )

            # Re-fetch under the still-held row lock so balance_after_* reflects
            # the actual post-update DB state, not Python arithmetic. This makes
            # the ledger snapshot robust to any future change in locking strategy.
            wallet.refresh_from_db(fields=("gems", "cou_points"))

            tx = WalletTransaction.objects.create(
                user_id=uid,
                kind=kind,
                delta_gems=delta_gems,
                delta_cou_points=delta_cou_points,
                balance_after_gems=wallet.gems,
                balance_after_cou_points=wallet.cou_points,
                related_round_id=related_round_id,
                related_coupon_id=related_coupon_id,
                related_store_id=related_store_id,
                note=note,
            )
            log.info(
                "spinner_coop.wallet_mutate",
                extra={
                    "user_id": uid,
                    "kind": kind,
                    "delta_gems": delta_gems,
                    "delta_cou_points": delta_cou_points,
                    "tx_id": tx.id,
                },
            )
            return tx
