"""
Server-authoritative solo spinner draw + state.

The mobile FE used to roll the multiplier client-side (useSpinLogic.ts). That
is moved here: the server owns the RNG, the reward table, and the wallet
mutation. The FE becomes a thin animator that targets the
sector the server returned.

Endpoints:
    GET  /api/spinner/        → {gems, floor, lastSpinAt}
    POST /api/spinner/draw/   → debits `bet` gems (1..5), rolls multiplier,
                                credits CouPoints, writes a WalletTransaction
                                row. Returns the result for the FE to animate.

Notes:
  * `bet` (1..5) in the request body sets how many gems to wager. The
    reward is `bet × multiplier` CouPoints.
  * `floor` shifts the available multipliers up based on the bet:
    same shape as the FE's getFloor(bet, players=1).
  * Per-multiplier odds come from the admin-tunable SpinnerConfig singleton
    (api.services.spinner_config), falling back to w(v)=1/(v+1).
  * `meltdownMultiplier` is deprecated (meltdown removed) and always null;
    retained in the response for already-shipped app builds.
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
from api.services.spinner_config import get_base_weights
from api.spinner_coop.models import Wallet, WalletTransaction
from api.spinner_coop.wallet_service import (
    InsufficientGemsError,
    WalletService,
)

logger = logging.getLogger(__name__)


# ── Reward table (mirrors Mobile-Frontend/src/features/spinner/constants.ts) ──
# The wheel sectors are these multiplier values. The *odds* of each are owned
# by the server: per-value weights come from the SpinnerConfig singleton
# (admin-tunable, falling back to w(v)=1/(v+1)). Changing weights does not
# change the wheel's appearance — the FE just lands on the value we return.
_BASE_MULTIPLIERS = (0, 1, 2, 3, 4, 5)

# Allowed bet range.
_MIN_BET = 1
_MAX_BET = 5


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


class InvalidBet(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INVALID_BET"
    default_detail = "Bet must be between 1 and 5."


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


def _roll_base_multiplier(floor: int, weights_map: dict[int, float] | None = None) -> int:
    """Weighted sample over _BASE_MULTIPLIERS filtered by `v >= floor`.

    Per-value weights come from the admin-tunable SpinnerConfig (falling back
    to w(v)=1/(v+1)). Callers may pass `weights_map` to avoid a DB read inside a
    transaction; when omitted it is fetched here. Uses secrets for
    crypto-strength randomness."""
    if weights_map is None:
        weights_map = get_base_weights()
    available = [v for v in _BASE_MULTIPLIERS if v >= floor]
    weights = [weights_map.get(v, 0.0) for v in available]
    total = sum(weights)
    if total <= 0:
        # Floor filtered out every weighted value (e.g. only sub-floor values
        # carry weight). Fall back to a uniform draw over the available set so
        # the spinner never deadlocks.
        weights = [1.0] * len(available)
        total = float(len(available))
    # secrets.randbits is integer-only; build a uniform float over [0, total).
    r = (secrets.randbits(53) / float(1 << 53)) * total
    acc = 0.0
    for v, w in zip(available, weights):
        acc += w
        if r < acc:
            return v
    return available[-1]  # numerical-edge fallback


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

    Required body:
        {"bet": <int 1..5>}   — number of gems to wager.

    Response:
        {
          "multiplier":          <0..5>,
          "meltdownMultiplier":  null,          # deprecated (meltdown removed), always null
          "gemsUsed":            <int>,         # bet amount (= reward base)
          "pointsEarned":        <int>,         # total CouPoints credited
          "gems":                <int>,         # post-debit balance
          "couPoints":           <int>,         # post-credit balance
          "transactionId":       <int>,
          "floor":               <int>,
          "spunAt":              <isoformat>
        }
    """
    user_id = request.user.id

    starter = max(0, int(getattr(settings, 'STARTER_GEMS', 0)))
    WalletService.ensure_wallet(user_id, initial_gems=starter)

    # Parse and validate bet.
    raw_bet = request.data.get('bet') if isinstance(request.data, dict) else None
    if raw_bet is None or type(raw_bet) is not int:
        bet = _MIN_BET
    else:
        bet = raw_bet
    if bet < _MIN_BET or bet > _MAX_BET:
        raise InvalidBet(
            developer_message=f"bet={bet} out of range [{_MIN_BET}, {_MAX_BET}].",
            context={'bet': bet, 'min': _MIN_BET, 'max': _MAX_BET},
        )

    interval = max(0, int(getattr(settings, 'SOLO_SPINNER_RATE_LIMIT_SECONDS', 2)))

    # Read the (admin-tunable) odds before opening the wallet transaction so we
    # don't hold the select_for_update lock across an unrelated DB read.
    weights_map = get_base_weights()

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user_id=user_id)
        gems_before = wallet.gems

        if gems_before < bet:
            raise NoGemsToSpin(
                developer_message=f"User {user_id} has {gems_before} gems, needs {bet}.",
                context={'have': gems_before, 'need': bet},
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

        floor = _get_floor(bet)
        base_mult = _roll_base_multiplier(floor, weights_map)
        points_earned = bet * base_mult

        try:
            tx = WalletService.mutate(
                user_id,
                delta_gems=-bet,
                delta_cou_points=points_earned,
                kind=WalletTransaction.Kind.SPINNER_SOLO,
                note=f"bet={bet} x{base_mult}",
            )
        except InsufficientGemsError as exc:
            raise WalletGemsDesync(
                developer_message=f"Concurrent debit for user {user_id}: {exc}",
            ) from exc

    logger.info(
        "spinner_solo.draw",
        extra={
            "user_id": user_id,
            "bet": bet,
            "multiplier": base_mult,
            "points_earned": points_earned,
            "tx_id": tx.id,
        },
    )

    return Response({
        'multiplier': base_mult,
        # Deprecated: meltdown was removed. Always null; kept in the payload so
        # already-shipped app builds that read this field don't break.
        'meltdownMultiplier': None,
        'gemsUsed': bet,
        'pointsEarned': points_earned,
        'gems': tx.balance_after_gems,
        'couPoints': tx.balance_after_cou_points,
        'transactionId': tx.id,
        'floor': floor,
        'spunAt': tx.created_at.isoformat(),
    })
