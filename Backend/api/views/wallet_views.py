"""
Wallet read endpoint.

Returns the authenticated user's CouGem + CouPoint balance from the single
source of truth (api.spinner_coop.models.Wallet). On first read, lazily
creates the wallet row with a STARTER_GEMS seed credit (logged via a
WalletTransaction of kind='seed' for history visibility).

Mutations live in spinner_views / coupoint_views (Phase 2); this is read-only.

Phase 8 additions:
  * GET /api/wallet/transactions/ — cursor-paginated WalletTransaction list.
  * GET /api/wallet/transactions/<id>/ — single-row detail.
"""

from __future__ import annotations

import logging
from typing import Iterable

from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.exceptions import CouProAPIException
from api.models import Coupon, Store
from api.spinner_coop.models import WalletTransaction
from api.spinner_coop.wallet_service import WalletService

logger = logging.getLogger(__name__)


# --- Constants --------------------------------------------------------------

DEFAULT_TX_LIMIT = 25
MAX_TX_LIMIT = 100

COUPON_KINDS: frozenset[str] = frozenset({
    WalletTransaction.Kind.COUPON_REDEEM,
    WalletTransaction.Kind.SHARE_REWARD,
    WalletTransaction.Kind.QR_CLAIM,
})

COUPOINT_KINDS: frozenset[str] = frozenset({
    WalletTransaction.Kind.SPINNER_SOLO,
    WalletTransaction.Kind.SPINNER_COOP,
    WalletTransaction.Kind.COUPOINT_SPEND,
})


# --- Exceptions -------------------------------------------------------------


class TransactionNotFound(CouProAPIException):
    """Wallet transaction does not exist or does not belong to the user."""

    status_code = 404
    error_code = "TRANSACTION_NOT_FOUND"


class InvalidTransactionFilter(CouProAPIException):
    status_code = 400
    error_code = "INVALID_TRANSACTION_FILTER"


# --- Helpers ----------------------------------------------------------------


def _bucket_for(kind: str) -> str:
    """Map a WalletTransaction.Kind value to the FE bucket ('coupon'|'coupoint')."""
    if kind in COUPOINT_KINDS:
        return 'coupoint'
    return 'coupon'


def _amount_for(tx: WalletTransaction, bucket: str) -> int:
    """Display amount: abs(delta_cou_points) for CouPoint flows, else abs(delta_gems)."""
    if bucket == 'coupoint':
        return abs(tx.delta_cou_points)
    return abs(tx.delta_gems)


def _detail_for(tx: WalletTransaction, store_name: str | None) -> str:
    """Human-readable single-line description for the history row.

    Falls back to the persisted note when present, otherwise derives a string
    from the kind + amount + store. Chinese copy mirrors the FE consumer voice.
    """
    if tx.note:
        return tx.note

    store_suffix = f' — {store_name}' if store_name else ''
    kind = tx.kind
    if kind == WalletTransaction.Kind.COUPON_REDEEM:
        return f"${abs(tx.delta_gems)} 折抵{store_suffix}".strip()
    if kind == WalletTransaction.Kind.SHARE_REWARD:
        return f"分享獎勵 +{abs(tx.delta_gems)}".strip()
    if kind == WalletTransaction.Kind.QR_CLAIM:
        return f"QR 兌換{store_suffix}".strip()
    if kind == WalletTransaction.Kind.SPINNER_SOLO:
        return f"轉盤兌換 +{abs(tx.delta_cou_points)} CouPoint".strip()
    if kind == WalletTransaction.Kind.SPINNER_COOP:
        return f"共玩轉盤 +{abs(tx.delta_cou_points)} CouPoint".strip()
    if kind == WalletTransaction.Kind.COUPOINT_SPEND:
        return f"CouPoint 折抵 ${abs(tx.delta_cou_points)}{store_suffix}".strip()
    if kind == WalletTransaction.Kind.SEED:
        return f"新手禮 +{abs(tx.delta_gems)}".strip()
    if kind == WalletTransaction.Kind.REFUND:
        return f"退款 +{abs(tx.delta_gems)}".strip()
    return tx.get_kind_display()


def _serialise(tx: WalletTransaction, store_name: str | None) -> dict:
    """Project a WalletTransaction row to the FE history item shape."""
    bucket = _bucket_for(tx.kind)
    return {
        'id': tx.id,
        'kind': tx.kind,
        'type': bucket,
        'store': store_name,
        'detail': _detail_for(tx, store_name),
        'amount': _amount_for(tx, bucket),
        'usedAt': tx.created_at.strftime('%Y-%m-%d %H:%M'),
        'balanceAfterGems': tx.balance_after_gems,
        'balanceAfterCouPoints': tx.balance_after_cou_points,
    }


def _resolve_store_names(rows: Iterable[WalletTransaction]) -> dict[int, str]:
    """Batch-load store names for any related_store_id present in the page."""
    store_ids = {r.related_store_id for r in rows if r.related_store_id}
    if not store_ids:
        return {}
    return {
        s.id: s.name
        for s in Store.objects.filter(id__in=store_ids).only('id', 'name')
    }


def _parse_positive_int(raw: str | None, *, default: int, maximum: int, field: str) -> int:
    if raw is None or raw == '':
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise InvalidTransactionFilter(
            developer_message=f"{field} must be an integer; got {raw!r}",
            context={'field': field},
        ) from exc
    if value <= 0:
        raise InvalidTransactionFilter(
            developer_message=f"{field} must be a positive integer; got {value}",
            context={'field': field},
        )
    return min(value, maximum)


def _parse_cursor(raw: str | None) -> int | None:
    if raw is None or raw == '':
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise InvalidTransactionFilter(
            developer_message=f"cursor must be an integer; got {raw!r}",
            context={'field': 'cursor'},
        ) from exc
    if value <= 0:
        raise InvalidTransactionFilter(
            developer_message=f"cursor must be a positive integer; got {value}",
            context={'field': 'cursor'},
        )
    return value


# --- Views ------------------------------------------------------------------


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_wallet(request):
    """GET /api/wallet/ → {gems, couPoints}.

    Lazily ensures the user has a Wallet row, seeding with settings.STARTER_GEMS
    on first creation. Subsequent calls return the current balance.

    Response shape mirrors the mobile FE WalletData contract (camelCase).
    """
    starter = max(0, int(getattr(settings, 'STARTER_GEMS', 0)))
    wallet = WalletService.ensure_wallet(request.user.id, initial_gems=starter)
    return Response({
        'gems': wallet.gems,
        'couPoints': wallet.cou_points,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_transactions(request):
    """GET /api/wallet/transactions/?type=&limit=&cursor= → cursor-paginated ledger.

    Returns the authenticated user's WalletTransaction rows ordered by id DESC
    (matching the auto-increment newest-first chronology that the FE renders).

    Query params:
      type   — 'all' (default) | 'coupon' | 'coupoint'
      limit  — page size, default 25, capped at 100
      cursor — id of the last row from the previous page (exclusive)
    """
    type_filter = request.query_params.get('type', 'all') or 'all'
    if type_filter not in {'all', 'coupon', 'coupoint'}:
        raise InvalidTransactionFilter(
            developer_message=f"type must be one of all|coupon|coupoint; got {type_filter!r}",
            context={'field': 'type'},
        )

    limit = _parse_positive_int(
        request.query_params.get('limit'),
        default=DEFAULT_TX_LIMIT,
        maximum=MAX_TX_LIMIT,
        field='limit',
    )
    cursor = _parse_cursor(request.query_params.get('cursor'))

    qs = WalletTransaction.objects.filter(user_id=request.user.id)
    if type_filter == 'coupon':
        qs = qs.filter(kind__in=COUPON_KINDS)
    elif type_filter == 'coupoint':
        qs = qs.filter(kind__in=COUPOINT_KINDS)
    if cursor is not None:
        qs = qs.filter(id__lt=cursor)

    # Fetch one extra to determine whether there's another page.
    rows = list(qs.order_by('-id')[: limit + 1])
    has_more = len(rows) > limit
    rows = rows[:limit]

    store_names = _resolve_store_names(rows)
    items = [_serialise(r, store_names.get(r.related_store_id)) for r in rows]
    next_cursor = rows[-1].id if has_more and rows else None

    return Response({'items': items, 'nextCursor': next_cursor})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_transaction(request, id: int):
    """GET /api/wallet/transactions/<id>/ → single-row detail.

    404 if the row does not exist or belongs to another user. Includes a
    {coupon: {id, name}} reference when related_coupon_id is set and the
    coupon record still exists.
    """
    try:
        tx = WalletTransaction.objects.get(id=id, user_id=request.user.id)
    except WalletTransaction.DoesNotExist as exc:
        raise TransactionNotFound(
            developer_message=f"transaction {id} not found for user {request.user.id}",
            context={'id': id},
        ) from exc

    store_name: str | None = None
    if tx.related_store_id:
        store_name = (
            Store.objects.filter(id=tx.related_store_id)
            .values_list('name', flat=True)
            .first()
        )

    payload = _serialise(tx, store_name)

    if tx.related_coupon_id:
        coupon = (
            Coupon.objects.filter(id=tx.related_coupon_id)
            .only('id', 'coupon_name')
            .first()
        )
        if coupon is not None:
            payload['coupon'] = {'id': coupon.id, 'name': coupon.coupon_name}

    return Response(payload)
