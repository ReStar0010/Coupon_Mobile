"""
Persistent models for the spinner co-op feature.

Wallet             — per-user gem and CouPoint balance (single source of truth).
WalletTransaction  — append-only ledger row for every Wallet mutation.
SpinnerRound       — append-only ledger row written at REVEAL → SETTLED.

These live in api/spinner_coop/models.py but Django requires app-level model
discovery. The migration is generated under api/migrations/ as usual; the
classes are re-exported from api.models via the import line at the bottom of
that file (added separately) so makemigrations finds them.

Atomicity:
  All wallet mutations go through the WalletService which wraps each operation
  in transaction.atomic + select_for_update. The SPINNING transition's caller
  (the WS consumer in 3b) wraps DEBIT_GEMS for ALL players in a single outer
  atomic block so the debit is all-or-nothing.

  Ledger-tracked mutations (history-visible) flow through WalletService.mutate
  which writes both the Wallet update and a WalletTransaction row inside the
  same atomic block.
"""

from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.db import models


class Wallet(models.Model):
    """One row per user. Holds the canonical gems and CouPoints balances."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="spinner_wallet",
        primary_key=True,
    )
    gems = models.PositiveIntegerField(default=0)
    cou_points = models.PositiveIntegerField(default=0)
    # Optimistic locking version. Bumped on every successful mutation.
    version = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "spinner_wallet"
        verbose_name = "Spinner wallet"
        verbose_name_plural = "Spinner wallets"

    def __str__(self) -> str:  # pragma: no cover (display only)
        return f"Wallet(user={self.user_id}, gems={self.gems}, cou_points={self.cou_points})"


class SpinnerRound(models.Model):
    """Ledger row written when a co-op round settles (REVEAL → SETTLED).

    Append-only: a row exists for every spin, including aborted ones (with
    aborted=True and shares=[]). Used for analytics, dispute resolution, and
    invariant audits.
    """

    round_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_id = models.CharField(max_length=64, db_index=True)

    # Round inputs
    num_players = models.PositiveSmallIntegerField()
    g_total = models.PositiveSmallIntegerField()  # Σ G_i
    f_floor = models.PositiveSmallIntegerField()
    m_multiplier = models.PositiveSmallIntegerField(null=True, blank=True)

    # Per-player breakdown — JSON list of {user_id, seat, stake, floor, excess, share}
    shares = models.JSONField(default=list)
    # Same structure as the room.reveal "shares" payload — easy to replay UI.

    # Lifecycle
    aborted = models.BooleanField(default=False)
    abort_reason = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    settled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "spinner_round"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["room_id", "-created_at"]),
            models.Index(fields=["aborted", "-created_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"SpinnerRound({self.round_id}, M={self.m_multiplier}, aborted={self.aborted})"

    @property
    def total_payout(self) -> int:
        """Σ share_i = G·M (locked invariant). Returns 0 for aborted rounds."""
        if self.aborted or self.m_multiplier is None:
            return 0
        return self.g_total * self.m_multiplier


class WalletTransaction(models.Model):
    """Append-only ledger row for every Wallet mutation.

    Single source of truth for "how did this balance get to where it is."
    Written inside the same transaction.atomic as the Wallet update by
    WalletService.mutate(). Used to back the user-facing history screens
    and to support dispute resolution and audit.

    Signed deltas: positive = credit, negative = debit.
    balance_after_* fields snapshot the wallet state immediately after the
    mutation so history pages don't have to sum the entire ledger.
    """

    class Kind(models.TextChoices):
        SPINNER_SOLO = 'spinner_solo', 'Spinner Solo'
        SPINNER_COOP = 'spinner_coop', 'Spinner Co-op'
        COUPON_REDEEM = 'coupon_redeem', 'Coupon Redeem'
        COUPOINT_SPEND = 'coupoint_spend', 'CouPoint Spend'
        SHARE_REWARD = 'share_reward', 'Share Reward'
        QR_CLAIM = 'qr_claim', 'QR Claim'
        SEED = 'seed', 'Starter Seed'
        REFUND = 'refund', 'Refund'

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='wallet_transactions',
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, db_index=True)

    delta_gems = models.IntegerField(default=0)
    delta_cou_points = models.IntegerField(default=0)

    balance_after_gems = models.PositiveIntegerField()
    balance_after_cou_points = models.PositiveIntegerField()

    related_round_id = models.UUIDField(null=True, blank=True)
    related_coupon_id = models.PositiveIntegerField(null=True, blank=True)
    related_store_id = models.PositiveIntegerField(null=True, blank=True)

    note = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'wallet_transaction'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='wallet_tx_user_recent_idx'),
            models.Index(fields=['kind', '-created_at'], name='wallet_tx_kind_recent_idx'),
        ]

    def __str__(self) -> str:  # pragma: no cover (display only)
        return (
            f"WalletTx(user={self.user_id}, kind={self.kind}, "
            f"Δg={self.delta_gems}, Δp={self.delta_cou_points})"
        )
