"""
CouPoint spend endpoint.

The Mobile-Frontend CouPointUseScreen scans a merchant QR (a QRCodeSession or
StoreFixedSession token), picks an amount in multiples of 5, and POSTs here
to atomically debit the consumer's CouPoints.

Endpoint:
    POST /api/coupoints/use/  {qrToken, amount} -> {couPoints, store, transactionId}

Resolution priority for the QR token:
    1. StoreFixedSession.session_token  → identifies the store directly
    2. QRCodeSession.session_token       → identifies a template; we walk
                                           template.store

Both kinds of session must be active. Inactive / unknown tokens 404.

Amount validation: must be a positive multiple of 5 (matches the FE stepper).
The maximum is the user's current balance.
"""

from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.exceptions import CouProAPIException
from api.throttles import RedemptionThrottle
from api.models import QRCodeSession, Store, StoreFixedSession
from api.spinner_coop.models import WalletTransaction
from api.spinner_coop.wallet_service import (
    InsufficientCouPointsError,
    WalletNotFoundError,
    WalletService,
)

logger = logging.getLogger(__name__)


# Amount must be a positive multiple of this — matches the FE stepper width.
_COUPOINT_STEP = 5


class CouPointAmountInvalid(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "COUPOINT_AMOUNT_INVALID"
    default_detail = "Amount must be a positive multiple of 5."


class CouPointQrTokenMissing(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "COUPOINT_QR_TOKEN_MISSING"
    default_detail = "qrToken is required."


class CouPointQrSessionNotFound(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "COUPOINT_QR_SESSION_NOT_FOUND"
    default_detail = "QR session not found or no longer active."


class InsufficientCouPoints(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INSUFFICIENT_COU_POINTS"
    default_detail = "Not enough CouPoints to spend that amount."


def _resolve_store(qr_token: str) -> Store | None:
    """Return the Store identified by a QR token (fixed or session), or None."""
    fixed = (
        StoreFixedSession.objects
        .filter(session_token=qr_token, is_active=True)
        .select_related('store')
        .first()
    )
    if fixed is not None:
        return fixed.store

    session = (
        QRCodeSession.objects
        .filter(session_token=qr_token, is_active=True)
        .select_related('template__store')
        .first()
    )
    if session is not None:
        return session.template.store
    return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([RedemptionThrottle])
def use_coupoints(request):
    """POST /api/coupoints/use/ {qrToken, amount}.

    Returns:
        {
            "couPoints":     <int>,     # post-debit balance
            "store":         {"id": int, "name": str, "address": str},
            "transactionId": <int>,
            "amount":        <int>
        }
    """
    body = request.data if isinstance(request.data, dict) else {}
    qr_token = body.get('qrToken')
    amount = body.get('amount')

    if not isinstance(qr_token, str) or not qr_token.strip():
        raise CouPointQrTokenMissing(
            developer_message="POST /api/coupoints/use/ requires qrToken as a non-empty string.",
        )

    if type(amount) is not int or amount <= 0 or amount % _COUPOINT_STEP != 0:
        raise CouPointAmountInvalid(
            developer_message=(
                "amount must be a positive int and divisible by "
                f"{_COUPOINT_STEP}; got {amount!r}."
            ),
            context={'step': _COUPOINT_STEP, 'received': amount},
        )

    store = _resolve_store(qr_token.strip())
    if store is None:
        raise CouPointQrSessionNotFound(
            developer_message=f"No active QR session for token {qr_token!r}.",
        )

    user_id = request.user.id

    # Ensure wallet exists (zero starter; CouPoint spends are not the path that
    # seeds a new account).
    WalletService.ensure_wallet(user_id, initial_gems=0)

    try:
        tx = WalletService.mutate(
            user_id,
            delta_cou_points=-amount,
            kind=WalletTransaction.Kind.COUPOINT_SPEND,
            related_store_id=store.id,
            note=f"Spent at {store.name}",
        )
    except InsufficientCouPointsError as exc:
        raise InsufficientCouPoints(
            developer_message=str(exc),
            context={'requested': amount, 'balance': exc.balance},
        ) from exc
    except WalletNotFoundError as exc:  # pragma: no cover — ensure_wallet preceded
        raise InsufficientCouPoints(developer_message=str(exc)) from exc

    logger.info(
        "coupoint.spend",
        extra={
            "user_id": user_id,
            "store_id": store.id,
            "amount": amount,
            "tx_id": tx.id,
        },
    )

    return Response({
        'couPoints': tx.balance_after_cou_points,
        'store': {
            'id': store.id,
            'name': store.name,
            'address': store.address or '',
        },
        'transactionId': tx.id,
        'amount': amount,
    })
