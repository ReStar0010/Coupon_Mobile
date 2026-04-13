import secrets

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from api.models import QRCodeSession, CouponTemplate, StoreFixedSession, WebRedemption


@api_view(['POST'])
@permission_classes([AllowAny])
def create_redemption(request):
    session_token = request.data.get('session_token', '').strip()
    fixed_session_token = request.data.get('fixed_session_token', '').strip()
    template_id = request.data.get('template_id')
    if not session_token and not fixed_session_token:
        return Response({'error': '缺少 session_token 或 fixed_session_token'}, status=status.HTTP_400_BAD_REQUEST)
    if session_token and fixed_session_token:
        return Response({'error': '請擇一傳入 session_token 或 fixed_session_token'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        template_id_int = int(template_id)
    except (TypeError, ValueError):
        return Response({'error': '缺少或無效的 template_id'}, status=status.HTTP_400_BAD_REQUEST)

    is_legacy_session_flow = bool(session_token)
    incoming_token = session_token or fixed_session_token

    # Legacy idempotency: session token can only redeem once.
    if is_legacy_session_flow and WebRedemption.objects.filter(
        session_token=session_token,
        fixed_session_token__isnull=True,
    ).exists():
        return Response({'error': '此優惠券已被核銷'}, status=status.HTTP_409_CONFLICT)

    session_store_id = None
    if is_legacy_session_flow:
        try:
            session = QRCodeSession.objects.select_related('template__store').get(
                session_token=session_token,
                is_active=True,
            )
        except QRCodeSession.DoesNotExist:
            return Response({'error': 'QR code 已過期或無效'}, status=status.HTTP_404_NOT_FOUND)
        session_store_id = session.template.store_id
    else:
        try:
            fixed_session = StoreFixedSession.objects.select_related('store').get(
                session_token=fixed_session_token,
                is_active=True,
            )
        except StoreFixedSession.DoesNotExist:
            return Response({'error': 'QR code 已過期或無效'}, status=status.HTTP_404_NOT_FOUND)
        session_store_id = fixed_session.store_id

    try:
        template = CouponTemplate.objects.select_related('store').get(id=template_id_int)
    except CouponTemplate.DoesNotExist:
        return Response({'error': '優惠券不存在或已下架'}, status=status.HTTP_404_NOT_FOUND)

    if template.store_id != session_store_id:
        return Response({'error': '優惠券與掃描店家不一致'}, status=status.HTTP_400_BAD_REQUEST)

    # Legacy claim flow keeps strict "active template only" behavior.
    # Fixed table-sticker flow is also used by User App redemption scanning, where
    # already-issued coupons may still need redemption even after template sold out.
    if is_legacy_session_flow and not template.is_active:
        return Response({'error': '優惠券不存在或已下架'}, status=status.HTTP_404_NOT_FOUND)

    if template.expiry_date and template.expiry_date <= timezone.now():
        return Response({'error': '優惠券已過期'}, status=status.HTTP_410_GONE)

    with transaction.atomic():
        # Double-check idempotency inside transaction for legacy flow.
        if is_legacy_session_flow and WebRedemption.objects.filter(
            session_token=session_token,
            fixed_session_token__isnull=True,
        ).exists():
            return Response({'error': '此優惠券已被核銷'}, status=status.HTTP_409_CONFLICT)

        updated = 1
        should_decrease_inventory = template.total_quantity > 0
        if should_decrease_inventory:
            updated = CouponTemplate.objects.filter(
                id=template.id,
                is_active=True,
                remaining_quantity__gt=0,
            ).update(remaining_quantity=F('remaining_quantity') - 1)

        # For fixed table sessions, allow redemption record creation even if template
        # inventory reached 0 (User App scan of already-issued coupon).
        if should_decrease_inventory and updated == 0 and is_legacy_session_flow:
            return Response({'error': '優惠券已售完'}, status=status.HTTP_410_GONE)

        # For fixed table sessions, keep `session_token` unique per redemption record.
        # This avoids collisions in environments that may still carry an older DB-level
        # unique constraint on api_web_redemption.session_token.
        persisted_session_token = (
            incoming_token
            if is_legacy_session_flow
            else f"{fixed_session_token}:{secrets.token_urlsafe(8)}"
        )

        web_redemption = WebRedemption.objects.create(
            template=template,
            session_token=persisted_session_token,
            fixed_session_token=fixed_session_token or None,
        )

    return Response({
        'redemption_id': web_redemption.id,
        'coupon_name': template.coupon_name,
        'store_name': template.store.name,
        'redeemed_at': web_redemption.redeemed_at.isoformat(),
    }, status=status.HTTP_201_CREATED)
