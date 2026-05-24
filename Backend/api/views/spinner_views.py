"""
Server-authoritative solo spinner draw + state.

The mobile FE used to roll the multiplier client-side (useSpinLogic.ts). That
is moved here: the server owns the RNG, the reward table, the meltdown roll,
and the wallet mutation. The FE becomes a thin animator that targets the
sector the server returned.

Endpoints:
    GET  /api/spinner/        → {gems, floor, lastSpinAt}
    POST /api/spinner/draw/   → debits 1 gem, rolls multiplier, credits
                                CouPoints, writes a WalletTransaction row.
                                Returns the result for the FE to animate to.

Notes:
  * Cost is fixed at 1 gem per spin — `gems` in the request body is treated
    as a client-side snapshot for desync detection (409 if it disagrees with
    the server-side balance).
  * `floor` shifts the available multipliers up when the user is holding
    more gems: same shape as the FE's getFloor(gems, players=1).
  * The meltdown bonus only fires on a base multiplier of 5; we surface
    `meltdownMultiplier` as a separate field so the FE can sequence its
    own animation.
  * Rate limit: server-enforced minimum interval (settings.SOLO_SPINNER_RATE_LIMIT_SECONDS)
    between consecutive solo draws per user — checked against the last
    SPINNER_SOLO WalletTransaction row.
"""

from __future__ import annotations

import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.exceptions import CouProAPIException
from api.spinner_coop.models import Wallet, WalletTransaction
from api.spinner_coop.wallet_service import (
    InsufficientGemsError,
    WalletService,
)

logger = logging.getLogger(__name__)


# ── Reward table (mirrors Mobile-Frontend/src/features/spinner/constants.ts) ──
# Base multipliers: weight = 1 / (v + 1). Higher values rarer.
_BASE_MULTIPLIERS = (0, 1, 2, 3, 4, 5)

# Meltdown roll (only when base multiplier == 5).
# (value, probability). Probabilities sum to 1.0.
_MELTDOWN_TABLE = (
    (2, 0.475),
    (3, 0.475),
    (5, 0.050),
)

# Fixed cost per spin in gems.
_SPIN_COST_GEMS = 1


# ── Errors (typed for the global exception handler) ──────────────────────────


class SpinRateLimited(CouProAPIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    error_code = "SPIN_RATE_LIMITED"
    default_detail = "Slow down — wait a moment before the next spin."


class WalletGemsDesync(CouProAPIException):
    status_code = status.HTTP_409_CONFLICT
    error_code = "WALLET_GEMS_DESYNC"
    default_detail = "Client gem count disagrees with server. Refresh wallet."


class NoGemsToSpin(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "NO_GEMS_TO_SPIN"
    default_detail = "You need at least 1 gem to spin."


# ── Reward math ──────────────────────────────────────────────────────────────


def _get_floor(gems: int, players: int = 1) -> int:
    """Solo path: floor=1 if gems>=3, else 0. Matches FE getFloor(gems, 1)."""
    if players >= 3:
        return 3
    if players >= 2:
        return 2
    if gems >= 3:
        return 1
    return 0


def _roll_base_multiplier(floor: int) -> int:
    """Weighted sample over _BASE_MULTIPLIERS filtered by `v >= floor`.
    Weight(v) = 1 / (v + 1). Uses secrets for crypto-strength randomness."""
    available = [v for v in _BASE_MULTIPLIERS if v >= floor]
    weights = [1.0 / (v + 1) for v in available]
    total = sum(weights)
    # secrets.randbelow is integer-only; build a uniform float over [0, total)
    # by combining two 32-bit randoms.
    r = (secrets.randbits(53) / float(1 << 53)) * total
    acc = 0.0
    for v, w in zip(available, weights):
        acc += w
        if r < acc:
            return v
    return available[-1]  # numerical-edge fallback


def _roll_meltdown() -> int:
    """Roll the bonus multiplier when the base multiplier is 5."""
    r = secrets.randbits(53) / float(1 << 53)
    acc = 0.0
    for v, p in _MELTDOWN_TABLE:
        acc += p
        if r < acc:
            return v
    return _MELTDOWN_TABLE[-1][0]


# ── Views ────────────────────────────────────────────────────────────────────


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_spinner_state(request):
    """GET /api/spinner/ → {gems, floor, lastSpinAt}."""
    wallet = WalletService.ensure_wallet(
        request.user.id,
        initial_gems=max(0, int(getattr(settings, 'STARTER_GEMS', 0))),
    )
    last_solo = (
        WalletTransaction.objects
        .filter(user_id=request.user.id, kind=WalletTransaction.Kind.SPINNER_SOLO)
        .order_by('-created_at')
        .values_list('created_at', flat=True)
        .first()
    )
    return Response({
        'gems': wallet.gems,
        'floor': _get_floor(wallet.gems),
        'lastSpinAt': last_solo.isoformat() if last_solo else None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def post_spinner_draw(request):
    """POST /api/spinner/draw/.

    Optional body:
        {"gems": <int>}   — client-side balance snapshot for desync detection.

    Response:
        {
          "multiplier":          <0..5>,
          "meltdownMultiplier":  <int|null>,    # set only when multiplier==5
          "gemsUsed":            <int>,         # pre-debit balance — reward base
          "pointsEarned":        <int>,         # total CouPoints credited
          "gems":                <int>,         # post-debit balance
          "couPoints":           <int>,         # post-credit balance
          "transactionId":       <int>,
          "floor":               <int>,
          "spunAt":              <isoformat>
        }
    """
    user_id = request.user.id

    # Ensure the wallet exists (lazy seed for very first spin) — same path
    # the /api/wallet/ endpoint takes. Outside the locked block; ensure_wallet
    # is itself atomic and cheap.
    starter = max(0, int(getattr(settings, 'STARTER_GEMS', 0)))
    WalletService.ensure_wallet(user_id, initial_gems=starter)

    interval = max(0, int(getattr(settings, 'SOLO_SPINNER_RATE_LIMIT_SECONDS', 2)))
    client_gems = request.data.get('gems') if isinstance(request.data, dict) else None

    # Roll the prize OUTSIDE the locked block — the inputs (floor) only
    # depend on the user's current gem balance, which we'll re-read under
    # the lock. We re-roll if the lock-time balance changes the floor.
    # The key invariant: ALL state checks (rate limit, balance, desync) and
    # the mutate() must execute under the same select_for_update lock so
    # no concurrent draw from the same user can interleave.
    #
    # H2 fix: rate-limit query + balance snapshot + mutate are now in one
    # atomic block, gated by the row lock.
    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user_id=user_id)
        gems_before = wallet.gems

        if gems_before < _SPIN_COST_GEMS:
            raise NoGemsToSpin(
                developer_message=f"User {user_id} has {gems_before} gems.",
                context={'have': gems_before, 'need': _SPIN_COST_GEMS},
            )

        if (
            client_gems is not None
            and type(client_gems) is int
            and client_gems != gems_before
        ):
            raise WalletGemsDesync(
                developer_message=(
                    f"Client thinks user {user_id} has {client_gems} gems, "
                    f"server has {gems_before}."
                ),
                context={'client': client_gems, 'server': gems_before},
            )

        if interval > 0:
            cutoff = timezone.now() - timedelta(seconds=interval)
            if (
                WalletTransaction.objects
                .filter(
                    user_id=user_id,
                    kind=WalletTransaction.Kind.SPINNER_SOLO,
                    created_at__gte=cutoff,
                )
                .exists()
            ):
                raise SpinRateLimited(
                    developer_message=f"User {user_id} solo-spinning faster than {interval}s.",
                    context={'retryAfterSeconds': interval},
                )

        floor = _get_floor(gems_before)
        base_mult = _roll_base_multiplier(floor)
        meltdown_mult: int | None = _roll_meltdown() if base_mult == 5 else None
        effective_mult = base_mult * (meltdown_mult if meltdown_mult else 1)
        points_earned = _SPIN_COST_GEMS * effective_mult

        try:
            tx = WalletService.mutate(
                user_id,
                delta_gems=-_SPIN_COST_GEMS,
                delta_cou_points=points_earned,
                kind=WalletTransaction.Kind.SPINNER_SOLO,
                note=(
                    f"x{base_mult}"
                    + (f" meltdown x{meltdown_mult}" if meltdown_mult else "")
                ),
            )
        except InsufficientGemsError as exc:
            # Defense in depth — should be impossible since we checked above
            # under the lock. Still translate to desync rather than 500.
            raise WalletGemsDesync(
                developer_message=f"Concurrent debit for user {user_id}: {exc}",
            ) from exc

    logger.info(
        "spinner_solo.draw",
        extra={
            "user_id": user_id,
            "gems_used": gems_before,
            "multiplier": base_mult,
            "meltdown_multiplier": meltdown_mult,
            "points_earned": points_earned,
            "tx_id": tx.id,
        },
    )

    return Response({
        'multiplier': base_mult,
        'meltdownMultiplier': meltdown_mult,
        'gemsUsed': gems_before,
        'pointsEarned': points_earned,
        'gems': tx.balance_after_gems,
        'couPoints': tx.balance_after_cou_points,
        'transactionId': tx.id,
        'floor': floor,
        'spunAt': tx.created_at.isoformat(),
    })
