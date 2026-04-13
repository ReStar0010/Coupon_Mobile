import secrets

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from api.models import QRCodeSession, CouponTemplate, StoreFixedSession, WebRedemption, Coupon, CouponRedemption, StudentProfile


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
    canonical_legacy_token: str | None = None
    canonical_fixed_token: str | None = None

    # Legacy idempotency: session token can only redeem once.
    if is_legacy_session_flow and WebRedemption.objects.filter(
        session_token__iexact=session_token,
        fixed_session_token__isnull=True,
    ).exists():
        return Response({'error': '此優惠券已被核銷'}, status=status.HTTP_409_CONFLICT)

    session_store_id = None
    if is_legacy_session_flow:
        try:
            session = QRCodeSession.objects.select_related('template__store').get(
                session_token__iexact=session_token,
                is_active=True,
            )
        except QRCodeSession.DoesNotExist:
            return Response({'error': 'QR code 已過期或無效'}, status=status.HTTP_404_NOT_FOUND)
        canonical_legacy_token = session.session_token
        session_store_id = session.template.store_id
    else:
        try:
            fixed_session = StoreFixedSession.objects.select_related('store').get(
                session_token__iexact=fixed_session_token,
                is_active=True,
            )
        except StoreFixedSession.DoesNotExist:
            return Response({'error': 'QR code 已過期或無效'}, status=status.HTTP_404_NOT_FOUND)
        canonical_fixed_token = fixed_session.session_token
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

    # App-based users may call this endpoint when scanning table QR from coupon detail.
    # In authenticated context, redeem the holder's exclusive coupon directly so the
    # coupon disappears from Collection (via CouponRedemption existence).
    if request.user.is_authenticated:
        holder_coupon = Coupon.objects.filter(
            template=template,
            coupon_type='exclusive',
            current_holder=request.user,
            expiry_date__gt=timezone.now(),
            start_date__lte=timezone.now(),
        ).order_by('id').first()
        if holder_coupon is not None:
            with transaction.atomic():
                already_redeemed = CouponRedemption.objects.filter(
                    coupon=holder_coupon,
                    user=request.user,
                ).exists()
                if already_redeemed:
                    return Response({'error': '此優惠券已被核銷'}, status=status.HTTP_409_CONFLICT)

                savings_amount = holder_coupon.estimated_savings or 0
                redemption = CouponRedemption.objects.create(
                    coupon=holder_coupon,
                    user=request.user,
                    savings_amount=savings_amount,
                    coupon_type=holder_coupon.coupon_type,
                )

                try:
                    student_profile = request.user.student_profile
                    student_profile.update_monthly_savings()
                    student_profile.coupons_used_count += 1
                    student_profile.total_savings += savings_amount
                    student_profile.monthly_savings += savings_amount
                    student_profile.save()
                except (StudentProfile.DoesNotExist, AttributeError):
                    pass

            return Response({
                'redemption_id': redemption.id,
                'coupon_name': holder_coupon.coupon_name,
                'store_name': template.store.name,
                'redeemed_at': redemption.redeemed_at.isoformat(),
            }, status=status.HTTP_201_CREATED)

    with transaction.atomic():
        # Double-check idempotency inside transaction for legacy flow.
        if is_legacy_session_flow and canonical_legacy_token is not None and WebRedemption.objects.filter(
            session_token=canonical_legacy_token,
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
        if is_legacy_session_flow:
            assert canonical_legacy_token is not None
            persisted_session_token = canonical_legacy_token
        else:
            assert canonical_fixed_token is not None
            persisted_session_token = f"{canonical_fixed_token}:{secrets.token_urlsafe(8)}"

        web_redemption = WebRedemption.objects.create(
            template=template,
            session_token=persisted_session_token,
            fixed_session_token=(canonical_fixed_token if not is_legacy_session_flow else None),
        )

    return Response({
        'redemption_id': web_redemption.id,
        'coupon_name': template.coupon_name,
        'store_name': template.store.name,
        'redeemed_at': web_redemption.redeemed_at.isoformat(),
    }, status=status.HTTP_201_CREATED)
