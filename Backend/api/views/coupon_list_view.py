"""
Consumer-facing coupon list endpoint (Phase 3).

GET /api/coupons/  → array of Coupon objects in the FE shape:
    {id, store, detail, expires, amount, status}

Projection rules:
  * filter by current_holder = request.user
  * exclusive-only (per the agreed plan to deprecate `store`-type coupons)
  * id          → str(coupon.id)              # FE expects string ids
  * store       → coupon.store.name           # flattened
  * detail      → coupon.coupon_detail
  * expires     → 'MM/DD' from coupon.expiry_date  # FE displays short form
  * amount      → int(coupon.estimated_savings or 0)
  * status      → 'redeemed' | 'shared' | 'active'   # derived

`tier` is intentionally NOT included — the field is a phantom on the FE
interface with no UI consumer. Phase 6 drops it from the FE type.
"""

from __future__ import annotations

import logging

from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.models import Coupon, CouponRedemption, CouponShareRequest

logger = logging.getLogger(__name__)


def _derive_status(is_redeemed: bool, has_pending_share: bool, expired: bool) -> str:
    if is_redeemed:
        return 'redeemed'
    if has_pending_share:
        return 'shared'
    if expired:
        return 'expired'
    return 'active'


def _serialize_coupon(c, *, is_redeemed: bool, has_pending_share: bool, now) -> dict:
    expired = c.expiry_date is not None and c.expiry_date <= now
    return {
        'id': str(c.id),
        'store': c.store.name if c.store else '',
        'detail': c.coupon_detail or '',
        'expires': c.expiry_date.strftime('%m/%d') if c.expiry_date else '',
        'amount': int(c.estimated_savings) if c.estimated_savings is not None else 0,
        'status': _derive_status(is_redeemed, has_pending_share, expired),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_my_coupons(request):
    """GET /api/coupons/ → consumer's currently-held exclusive coupons.

    Includes recently-redeemed exclusives so the user can still see history
    in the home list — clients can filter by status if they want only active.
    """
    now = timezone.now()
    user = request.user

    redeemed_subq = CouponRedemption.objects.filter(
        coupon=OuterRef('pk'), user=user
    )
    shared_pending_subq = CouponShareRequest.objects.filter(
        coupon=OuterRef('pk'), from_user=user, status='pending'
    )

    # Hot-path list — cap payload at 200 rows. The FE renders this in a
    # single FlatList; users with >200 held coupons are an edge case that
    # can be paginated later if it ever shows up.
    qs = (
        Coupon.objects
        .filter(current_holder=user, coupon_type='exclusive')
        .select_related('store')
        .annotate(
            _is_redeemed=Exists(redeemed_subq),
            _has_pending_share=Exists(shared_pending_subq),
        )
        .order_by('-id')[:200]
    )

    payload = [
        _serialize_coupon(
            c,
            is_redeemed=c._is_redeemed,
            has_pending_share=c._has_pending_share,
            now=now,
        )
        for c in qs
    ]
    return Response(payload)
