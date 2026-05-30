"""
Merchant discovery + bottom-sheet data + StoreNews CRUD (Phase 4).

Consumer-facing:
    GET    /api/merchants/nearby/?lat&lng&radius   → nearby merchant pins
    GET    /api/merchants/<id>/                    → merchant + sheet data
    POST   /api/merchants/<id>/flag/   {reason, details?}  → alias for ReportContentView (store)
    POST   /api/merchants/<id>/block/                       → alias for BlockMerchantView
    DELETE /api/merchants/<id>/block/                       → alias for UnblockMerchantView
    GET    /api/merchants/blocked/                          → FE-shaped reshape of BlockedMerchantsListView

Merchant-facing:
    GET    /api/merchant/news/                              → list owned news
    POST   /api/merchant/news/         {body}               → create news
    DELETE /api/merchant/news/<int:id>/                     → delete own news

The merchant-side endpoints scope every read/write to the merchant's
owned_stores; consumers can never CRUD news through these routes.
"""

from __future__ import annotations

import logging
import math

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.exceptions import CouProAPIException
from api.models import (
    BlockedMerchant,
    Coupon,
    CouponShareRequest,
    Store,
    StoreNews,
)
from api.utils import display_face_value

logger = logging.getLogger(__name__)


# ── Errors ───────────────────────────────────────────────────────────────────


class MerchantNearbyParamsInvalid(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "MERCHANT_NEARBY_PARAMS_INVALID"
    default_detail = "lat and lng are required as floats; radius optional km."


class MerchantNotFound(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "MERCHANT_NOT_FOUND"
    default_detail = "Merchant store not found."


class NoStoreForMerchant(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "NO_STORE_FOR_MERCHANT"
    default_detail = "Authenticated merchant has no owned store."


class StoreNewsBodyInvalid(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "STORE_NEWS_BODY_INVALID"
    default_detail = "News body required (1–200 chars)."


# Upper clamp for explicit radius queries; omitting `radius` now means
# "return all stores, no proximity filter" (see list_nearby_merchants).
_NEARBY_MAX_RADIUS_KM = 10.0
_EARTH_RADIUS_KM = 6371.0
# Hard cap when `radius` is omitted so the endpoint never returns a payload
# larger than a single map screen can render or a single response can carry.
# Stores are pre-sorted by distance to the request lat/lng before slicing so the
# cap keeps the nearest 500 — that's what a consumer actually wants when they
# said "show me everything".
_NEARBY_NO_RADIUS_MAX_ROWS = 500


# ── Helpers ──────────────────────────────────────────────────────────────────


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng points."""
    a_lat = math.radians(lat1)
    b_lat = math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    h = (math.sin(d_lat / 2) ** 2
         + math.cos(a_lat) * math.cos(b_lat) * math.sin(d_lng / 2) ** 2)
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def _bbox(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """Approximate bounding box for the prefilter.

    1 degree latitude ≈ 111 km. 1 degree longitude depends on latitude.
    We slightly over-fetch then refine with Haversine.
    """
    d_lat = radius_km / 111.0
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    d_lng = radius_km / (111.0 * cos_lat)
    return (lat - d_lat, lat + d_lat, lng - d_lng, lng + d_lng)


def _serialize_merchant_summary(store: Store) -> dict:
    """FE Merchant shape used by /api/merchants/nearby/ and /api/merchants/blocked/."""
    return {
        'id': str(store.id),
        'name': store.name or '',
        'category': store.store_type or 'other',
        'lat': store.lat,
        'lng': store.lng,
        'address': store.address or '',
        'verified': bool(store.owner_id),  # has an owner row → verified merchant
        'logoUrl': store.image_url or None,
    }


def _serialize_merchant_coupon(c: Coupon) -> dict:
    """Project Coupon to the FE MerchantCoupon shape used by the bottom-sheet."""
    return {
        'id': str(c.id),
        'label': c.coupon_name or '',
        'detail': c.coupon_detail or '',
        'expires': c.expiry_date.strftime('%m/%d') if c.expiry_date else '',
        'amount': int(c.estimated_savings) if c.estimated_savings is not None else 0,
    }


def _serialize_shared_coupon(share: CouponShareRequest) -> dict:
    """FE SharedCoupon shape — public-pool share request rendered as a tile."""
    coupon = share.coupon
    label = coupon.coupon_name or '折抵'
    return {
        'token': share.token,
        'store': coupon.store.name if coupon.store else '',
        'amount': int(coupon.estimated_savings) if coupon.estimated_savings is not None else 0,
        'sharer': (share.from_user.first_name or share.from_user.username or '')[:40],
        'msg': share.message,
        'label': label,
    }


def _serialize_news(row: StoreNews) -> dict:
    """FE MerchantNews shape."""
    return {
        'id': row.id,
        'author': row.store.name if row.store_id and row.store else '',
        'agoText': _ago_text(row.created_at),
        'body': row.body,
        'createdAt': row.created_at.isoformat(),
    }


def _ago_text(when) -> str:
    """Compact 'N 分鐘前' / 'N 小時前' / 'N 天前' for the news bubble."""
    delta = timezone.now() - when
    secs = int(delta.total_seconds())
    if secs < 60:
        return '剛剛'
    if secs < 3600:
        return f'{secs // 60} 分鐘前'
    if secs < 86_400:
        return f'{secs // 3600} 小時前'
    return f'{secs // 86_400} 天前'


def _resolve_merchant_store(user) -> Store | None:
    """First owned store for the authenticated merchant, or None."""
    return user.owned_stores.first() if user.is_authenticated else None


# ── Consumer endpoints ───────────────────────────────────────────────────────


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_nearby_merchants(request):
    """GET /api/merchants/nearby/?lat&lng[&radius] (km).

    When `radius` is provided, applies the bounding-box prefilter + Haversine
    refinement. When `radius` is omitted, returns every store with lat/lng set
    (still excluding the user's blocked merchants) — the consumer mobile app
    relies on this to render every pin regardless of proximity.
    Returns the FE Merchant shape.
    """
    try:
        lat = float(request.query_params.get('lat'))
        lng = float(request.query_params.get('lng'))
    except (TypeError, ValueError):
        raise MerchantNearbyParamsInvalid(
            developer_message="lat and lng query params must be floats.",
        )

    radius_raw = request.query_params.get('radius')
    radius: float | None
    if radius_raw is None:
        radius = None
    else:
        try:
            radius = float(radius_raw)
        except (TypeError, ValueError):
            raise MerchantNearbyParamsInvalid(
                developer_message=f"radius must be a float; got {radius_raw!r}.",
            )
        radius = max(0.1, min(_NEARBY_MAX_RADIUS_KM, radius))

    blocked_ids = BlockedMerchant.objects.filter(user=request.user).values_list('store_id', flat=True)

    # `is_visible_on_map` is the partnership gate — pins are only rendered for
    # stores we have a signed agreement with, regardless of distance / coords.
    # See migration 0061 for the launch-partner backfill.
    qs = (
        Store.objects
        .filter(lat__isnull=False, lng__isnull=False, is_visible_on_map=True)
        .exclude(id__in=blocked_ids)
        .only('id', 'name', 'lat', 'lng', 'address', 'store_type', 'image_url', 'owner_id')
    )

    if radius is not None:
        min_lat, max_lat, min_lng, max_lng = _bbox(lat, lng, radius)
        qs = qs.filter(lat__gte=min_lat, lat__lte=max_lat, lng__gte=min_lng, lng__lte=max_lng)

    in_range: list[tuple[Store, float]] = []
    for store in qs:
        dist = _haversine_km(lat, lng, store.lat, store.lng)
        if radius is not None and dist > radius:
            continue
        in_range.append((store, dist))

    # Bound the no-radius response — keep the N nearest so the FE never gets a
    # runaway payload. The radius-bounded path is already self-limiting.
    if radius is None and len(in_range) > _NEARBY_NO_RADIUS_MAX_ROWS:
        in_range.sort(key=lambda pair: pair[1])
        in_range = in_range[:_NEARBY_NO_RADIUS_MAX_ROWS]

    # Batch the two count queries instead of N+1 per store. The pin badge shows
    # "actionable coupons here" = user's held exclusives + public shared pool.
    now = timezone.now()
    store_ids = [s.id for s, _ in in_range]
    held_counts = dict(
        Coupon.objects
        .active_for_user(request.user, now=now)
        .filter(store_id__in=store_ids)
        .values('store_id')
        .annotate(n=Count('id'))
        .values_list('store_id', 'n')
    )
    shared_counts = dict(
        CouponShareRequest.objects
        .filter(
            coupon__store_id__in=store_ids,
            is_public=True,
            status='pending',
        )
        .exclude(from_user=request.user)
        .values('coupon__store_id')
        .annotate(n=Count('id'))
        .values_list('coupon__store_id', 'n')
    )

    payload: list[dict] = []
    for store, dist in in_range:
        row = _serialize_merchant_summary(store)
        row['distanceKm'] = round(dist, 2)
        row['couponCount'] = held_counts.get(store.id, 0) + shared_counts.get(store.id, 0)
        row['hasSharedCoupons'] = shared_counts.get(store.id, 0) > 0
        payload.append(row)

    payload.sort(key=lambda r: r['distanceKm'])
    return Response(payload)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_merchant_detail(request, id: int):
    """GET /api/merchants/<id>/ → Merchant + bottom-sheet data.

    Adds myCoupons (consumer's exclusives at this store), sharedCoupons
    (public-pool share requests at this store), and news (latest 5).
    """
    try:
        store = Store.objects.get(id=id)
    except Store.DoesNotExist:
        raise MerchantNotFound(developer_message=f"No store with id {id}.")

    now = timezone.now()

    # The serializer doesn't touch coupon.store (we already have the store
    # from the path argument), so no select_related needed. Cap at 20 — the
    # sheet shows a horizontal carousel; more than 20 owned at one merchant
    # is unrealistic for a single bottom-sheet glance.
    my_coupons_qs = (
        Coupon.objects
        .active_for_user(request.user, now=now)
        .at_store(store)
        .order_by('-id')[:20]
    )

    shared_coupons_qs = (
        CouponShareRequest.objects
        .filter(
            is_public=True,
            status='pending',
            coupon__store=store,
        )
        .exclude(from_user=request.user)
        .select_related('coupon', 'coupon__store', 'from_user')
        .order_by('-created_at')[:20]
    )

    # Surface the user's OWN outstanding public shares at this store as a
    # separate read-only section. The sharer can't self-claim (blocked at
    # accept_share_request), but they need visual confirmation that the
    # share landed — otherwise an empty sharedCoupons list looks like a
    # silent failure when the user is testing their own share.
    my_public_shares_qs = (
        CouponShareRequest.objects
        .filter(
            from_user=request.user,
            is_public=True,
            status='pending',
            coupon__store=store,
        )
        .select_related('coupon', 'coupon__store', 'from_user')
        .order_by('-created_at')[:20]
    )

    news_qs = StoreNews.objects.filter(store=store).select_related('store').order_by('-created_at')[:5]

    base = _serialize_merchant_summary(store)
    base['myCoupons'] = [_serialize_merchant_coupon(c) for c in my_coupons_qs]
    base['sharedCoupons'] = [_serialize_shared_coupon(s) for s in shared_coupons_qs]
    base['myPublicShares'] = [_serialize_shared_coupon(s) for s in my_public_shares_qs]
    base['news'] = [_serialize_news(n) for n in news_qs]
    return Response(base)


# ── Blocked-merchants list (consumer) — FE-shaped reshape ────────────────────


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_blocked_merchants(request):
    """GET /api/merchants/blocked/ — flattened Merchant[] shape."""
    rows = (
        BlockedMerchant.objects
        .filter(user=request.user)
        .select_related('store')
        .order_by('-created_at')
    )
    return Response([_serialize_merchant_summary(r.store) for r in rows if r.store_id])


# ── Flag / Block / Unblock aliases ────────────────────────────────────────────


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def flag_merchant(request, id: int):
    """POST /api/merchants/<id>/flag/ → delegates to ReportContentView (store).

    Body: {reason, details?}. Reuses the existing UGC reporting view.
    """
    from api.views.content_moderation import ReportContentView
    view = ReportContentView.as_view()
    return view(request._request, content_type='store', content_id=id)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def block_unblock_merchant(request, id: int):
    """Single endpoint for /api/merchants/<id>/block/ with method dispatch.

    POST   → block the merchant
    DELETE → unblock the merchant

    Implements the same semantics as BlockMerchantView / UnblockMerchantView,
    but without the cross-view delegation: the path captures the store_id so
    we don't need to forge a request body.
    """
    try:
        store = Store.objects.get(id=id)
    except Store.DoesNotExist:
        return Response(
            {'error': '找不到該商店'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == 'POST':
        if store.owner_id == request.user.id:
            return Response(
                {'error': '您無法封鎖自己的商店'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if BlockedMerchant.objects.filter(user=request.user, store=store).exists():
            return Response(
                {'error': '您已封鎖此商店'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        BlockedMerchant.objects.create(user=request.user, store=store)
        return Response(
            _serialize_merchant_summary(store),
            status=status.HTTP_201_CREATED,
        )

    # DELETE
    deleted, _ = BlockedMerchant.objects.filter(user=request.user, store=store).delete()
    if deleted == 0:
        return Response(
            {'error': '此商店未被封鎖'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Merchant news CRUD ───────────────────────────────────────────────────────


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def merchant_news_collection(request):
    """GET    /api/merchant/news/                 → list this merchant's news
    POST   /api/merchant/news/        {body}    → create news on this merchant's store
    """
    store = _resolve_merchant_store(request.user)
    if store is None:
        raise NoStoreForMerchant(
            developer_message=f"User {request.user.id} owns no Store.",
        )

    if request.method == 'GET':
        rows = StoreNews.objects.filter(store=store).order_by('-created_at')[:50]
        return Response([_serialize_news(n) for n in rows])

    # POST
    body = request.data.get('body') if isinstance(request.data, dict) else None
    if not isinstance(body, str) or not body.strip() or len(body) > 200:
        raise StoreNewsBodyInvalid(
            developer_message=f"body must be a non-empty string ≤200 chars; got {type(body).__name__}",
        )

    row = StoreNews.objects.create(store=store, body=body.strip())
    logger.info(
        "store_news.created",
        extra={"merchant_id": request.user.id, "store_id": store.id, "news_id": row.id},
    )
    return Response(_serialize_news(row), status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def merchant_news_detail(request, id: int):
    """DELETE /api/merchant/news/<id>/ → delete one of this merchant's news rows.

    404 if the row doesn't exist OR belongs to another merchant's store.
    """
    store = _resolve_merchant_store(request.user)
    if store is None:
        raise NoStoreForMerchant(
            developer_message=f"User {request.user.id} owns no Store.",
        )
    try:
        row = StoreNews.objects.get(id=id, store=store)
    except StoreNews.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    row.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
