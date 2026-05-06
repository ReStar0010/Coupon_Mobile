from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, F, OuterRef, Prefetch
import logging
import re
from urllib.parse import unquote
from drf_yasg.utils import swagger_auto_schema

from api.exceptions import (
    CouProAPIException,
    CouponAlreadyRedeemed,
    CouponNotHolder,
    RedeemCodeInvalid,
    UnifiedCodeInvalid,
)
from ..serializers import RedeemCouponSerializer, UnifiedRedemptionValidateSerializer
from ..models import Coupon, Log, StudentProfile, CouponRedemption, CouponShareRequest, Store, BlockedMerchant, PlatformVoucher, PlatformVoucherRedemption, PlatformVoucherShareRequest, QRCodeSession, StoreFixedSession
from ..utils import apply_referral_reward, display_face_value, increment_sharing_progress_for_redeemer

logger = logging.getLogger(__name__)


def _parse_web_table_qr_payload(raw_code: str) -> tuple[str, str] | None:
    s = raw_code.strip()
    fixed_match = re.search(r"/(?:w/)?claim-fixed/([^/?#]+)/?", s, re.IGNORECASE)
    if fixed_match and fixed_match.group(1):
        return ("fixed", fixed_match.group(1))

    legacy_match = re.search(r"/(?:w/)?claim/([^/?#]+)/?", s, re.IGNORECASE)
    if legacy_match and legacy_match.group(1):
        return ("legacy", legacy_match.group(1))

    query_match = re.search(r"[?&]token=([^&#]+)", s, re.IGNORECASE)
    if query_match and query_match.group(1):
        return ("legacy", unquote(query_match.group(1)))
    return None

@api_view(['GET'])
@permission_classes([AllowAny])  # 允許匿名訪問
def get_store_coupons(request):
    """
    Get type A coupons (store coupons) and public pool coupons (shared exclusive coupons).
    These are the general "identification" coupons that can be used multiple times,
    plus exclusive coupons that have been shared to the public pool.
    """

    now = timezone.now()

    # UGC Compliance: Get blocked store IDs for authenticated users
    blocked_store_ids = []
    if request.user.is_authenticated:
        blocked_store_ids = list(
            BlockedMerchant.objects.filter(user=request.user).values_list('store_id', flat=True)
        )

    # Query 1: Store coupons — annotate redemption counts in a single query to avoid N+1
    store_coupons = Coupon.objects.filter(
        coupon_type='store',
        expiry_date__gt=now,
        start_date__lte=now
    ).select_related('store', 'store__owner').prefetch_related('tags').annotate(
        total_redemptions_count=Count('redemptions', distinct=True),
        unique_users_count=Count('redemptions__user', distinct=True),
    )

    # UGC Compliance: Exclude blocked merchants
    if blocked_store_ids:
        store_coupons = store_coupons.exclude(store_id__in=blocked_store_ids)

    # Evaluate once; build active_counts_dict in Python to avoid a second DB round-trip
    # (deriving the count from the annotated queryset risks inflated counts due to JOIN)
    store_coupons_list = list(store_coupons)
    active_counts_dict: dict[int, int] = {}
    for c in store_coupons_list:
        active_counts_dict[c.store_id] = active_counts_dict.get(c.store_id, 0) + 1

    # Query 2: Public pool coupons (shared exclusive coupons)
    public_share_coupon_ids = CouponShareRequest.objects.filter(
        is_public=True,
        status='pending'
    ).values_list('coupon_id', flat=True)

    public_pool_coupons = Coupon.objects.filter(
        id__in=public_share_coupon_ids,
        coupon_type='exclusive',
        expiry_date__gt=now,
        start_date__lte=now,
        current_holder__isnull=True  # Ensure not already claimed
    ).select_related('store', 'store__owner').prefetch_related('tags', Prefetch('share_requests', queryset=CouponShareRequest.objects.select_related('from_user')))

    # UGC Compliance: Exclude blocked merchants from public pool as well
    if blocked_store_ids:
        public_pool_coupons = public_pool_coupons.exclude(store_id__in=blocked_store_ids)

    data = []

    # Add store coupons
    for c in store_coupons_list:
        store_active_count = active_counts_dict.get(c.store_id, 0)

        data.append({
            "id": c.id,
            "store_name": c.store.name,
            "store_id": c.store.id,
            "store_location": {
                "lat": c.store.lat,
                "lng": c.store.lng
            },
            "address": c.store.address,
            "active_coupon_count": store_active_count,
            "has_active_coupons": store_active_count > 0,
            "coupon_name": c.coupon_name,
            "coupon_detail": c.coupon_detail,
            "important_notes": c.important_notes,
            "start_date": c.start_date,
            "expiry_date": c.expiry_date,
            "coupon_type": c.coupon_type,
            "image_url": c.image_url,
            "total_redemptions": c.total_redemptions_count,
            "unique_users": c.unique_users_count,
            "tags": [tag.display_name for tag in c.tags.all()],
            "is_public_share": False,
            "share_token": None,
            "shared_by": None,
            "merchant_deleted": c.store.owner is None,
        })

    # Add public pool coupons
    for c in public_pool_coupons:
        # Use prefetch cache — .filter() would bypass it and hit DB per coupon (N+1)
        share_request = next(
            (sr for sr in c.share_requests.all() if sr.is_public and sr.status == 'pending'),
            None,
        )
        if share_request:
            data.append({
                "id": c.id,
                "store_name": c.store.name,
                "store_id": c.store.id,
                "store_location": {
                    "lat": c.store.lat,
                    "lng": c.store.lng
                },
                "address": c.store.address,
                "active_coupon_count": 1,
                "has_active_coupons": True,
                "coupon_name": c.coupon_name,
                "coupon_detail": c.coupon_detail,
                "important_notes": c.important_notes,
                "start_date": c.start_date,
                "expiry_date": c.expiry_date,
                "coupon_type": "gift",  # Special type to differentiate in frontend
                "image_url": c.image_url,
                "total_redemptions": 0,
                "unique_users": 0,
                "tags": [tag.display_name for tag in c.tags.all()],
                "is_public_share": True,
                "share_token": share_request.token,
                "shared_by": share_request.from_user.email,
                "merchant_deleted": c.store.owner is None,
            })

    # Add public pool platform vouchers
    public_voucher_shares = PlatformVoucherShareRequest.objects.filter(
        is_public=True,
        status='pending',
        voucher__expiry_date__gt=now,
        voucher__start_date__lte=now,
    ).select_related('voucher', 'from_user')

    for share in public_voucher_shares:
        v = share.voucher
        face = display_face_value(v.face_value)
        data.append({
            "id": v.id,
            "store_name": "平台現金券",
            "store_id": None,
            "store_location": None,
            "address": None,
            "active_coupon_count": 1,
            "has_active_coupons": True,
            "coupon_name": f"${face} {v.currency_code} 現金券",
            "coupon_detail": v.batch_name or "",
            "important_notes": "",
            "start_date": v.start_date,
            "expiry_date": v.expiry_date,
            "coupon_type": "platform_voucher_gift",
            "image_url": None,
            "total_redemptions": 0,
            "unique_users": 0,
            "tags": [],
            "is_public_share": True,
            "share_token": share.token,
            "shared_by": share.from_user.email,
            "merchant_deleted": False,
        })

    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])  # 需要身份驗證，因為這是個人專屬優惠
def get_exclusive_coupons(request):
    """
    Get type B coupons (exclusive coupons) that belong to the authenticated user.
    These are coupons received by drawing or shared from others.
    """
    now = timezone.now()

    # UGC Compliance: Get blocked store IDs
    blocked_store_ids = list(
        BlockedMerchant.objects.filter(user=request.user).values_list('store_id', flat=True)
    )

    # 查詢：未過期、已開始，且屬於當前用戶的專屬優惠券
    # 包括用戶是原始擁有者或當前持有者的券
    redeemed_subquery = Exists(
        CouponRedemption.objects.filter(coupon=OuterRef('pk'))
    )
    private_pending_exists = CouponShareRequest.objects.filter(
        coupon_id=OuterRef('pk'),
        from_user=request.user,
        is_public=False,
        status='pending',
    )
    exclusive_coupons = Coupon.objects.filter(
        coupon_type='exclusive',
        expiry_date__gt=now,
        start_date__lte=now,
        current_holder=request.user,  # 當前持有者是請求的用戶
    ).annotate(
        _is_redeemed=redeemed_subquery,
        _has_pending_private_share=Exists(private_pending_exists),
    ).filter(
        _is_redeemed=False,
    ).select_related('store', 'store__owner', 'template', 'original_owner', 'last_holder').prefetch_related('tags')

    # UGC Compliance: Exclude blocked merchants
    if blocked_store_ids:
        exclusive_coupons = exclusive_coupons.exclude(store_id__in=blocked_store_ids)

    # 檢查這些券是否已被兌換
    data = []
    for c in exclusive_coupons:
        is_redeemed = c._is_redeemed
        data.append({
            "id": c.id,
            "store_name": c.store.name,
            "store_id": c.store.id,
            "store_location": {
                "lat": c.store.lat,
                "lng": c.store.lng
            },
            "address": c.store.address,
            "coupon_name": c.coupon_name,
            "coupon_detail": c.coupon_detail,
            "important_notes": c.important_notes,
            "start_date": c.start_date,
            "expiry_date": c.expiry_date,
            "coupon_type": c.coupon_type,
            "redeem_code": c.redeem_code,
            "image_url": c.image_url,
            "is_redeemed": is_redeemed,
            "original_owner_email": c.original_owner.email if c.original_owner else None,
            "last_holder_email": c.last_holder.email if c.last_holder else None,
            "estimated_savings": c.estimated_savings,
            "tags": [tag.display_name for tag in c.tags.all()],  # 返回標籤的顯示名稱
            "merchant_deleted": c.store.owner is None,
            "has_pending_private_share": c._has_pending_private_share,
        })
    
    return Response(data)

@api_view(['GET'])
@permission_classes([AllowAny])  # 明確允許匿名訪問
def get_coupon_detail(request, id):

    now = timezone.now()
    coupon = get_object_or_404(
        Coupon.objects.select_related('store', 'store__owner', 'template', 'original_owner', 'last_holder').prefetch_related('tags'),
        id=id,
    )
    
    if request.user.is_authenticated:
        # Get location from query parameters if available
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        
        # Convert to float if provided, otherwise None
        lat_float = None
        lng_float = None
        try:
            if lat is not None:
                lat_float = float(lat)
            if lng is not None:
                lng_float = float(lng)
        except (ValueError, TypeError):
            # Invalid location data, continue without location
            pass
         
    if coupon.coupon_type == 'store':
        # Type A: Store coupon (可多次使用的識別型優惠券)
        
        # 計算該 coupon 所屬 store 的有效 coupon 數量
        store_active_count = Coupon.objects.filter(
            store_id=coupon.store_id,
            coupon_type='store',
            expiry_date__gt=now,
            start_date__lte=now
        ).count()
        
        # Check if authenticated user has used this store coupon today
        has_used_today = False
        if request.user.is_authenticated:
            today = timezone.localtime(now).date()

            # Check for redemption of this coupon by the current user today
            has_used_today = CouponRedemption.objects.filter(
                coupon=coupon,
                user=request.user,
                redeemed_at__date=today  # Compare only the date part (YYYY-MM-DD)
            ).exists()

        can_use_today = True
        if coupon.usage_per_day == 'one-time' and has_used_today:
            can_use_today = False 

        data = {
            "id": coupon.id,
            "store_name": coupon.store.name,
            "store_id": coupon.store.id,
            "store_location": {
                "lat": coupon.store.lat,
                "lng": coupon.store.lng
            },
            "address": coupon.store.address,
            "active_coupon_count": store_active_count,
            "coupon_name": coupon.coupon_name,
            "coupon_detail": coupon.coupon_detail,
            "important_notes": coupon.important_notes,
            "start_date": coupon.start_date,
            "expiry_date": coupon.expiry_date,
            "coupon_type": coupon.coupon_type,
            "image_url": coupon.image_url,
            "template_id": coupon.template.id if coupon.template else None,  # Add template_id
            "total_redemptions": coupon.get_redemption_count(),
            "unique_users": coupon.get_unique_users_count(),
            "can_use_today": can_use_today,
            "tags": [tag.display_name for tag in coupon.tags.all()],  # 返回標籤的顯示名稱
            "merchant_deleted": coupon.store.owner is None,
            "acquisition_method": getattr(coupon, "acquisition_method", None) or None,  # store coupons typically null
        }

    else:
        # Type B: Exclusive coupon (專屬優惠券)
        
        # 檢查此 coupon 是否已被兌換
        is_redeemed = coupon.is_redeemed()
        
        # 檢查請求用戶是否有權查看此優惠券的詳細信息
        is_authorized = request.user.is_authenticated and coupon.current_holder == request.user
        
        # 如果未登錄或不是券的持有者，回傳標準錯誤（前端以 error_code COUPON_NOT_HOLDER 顯示翻譯）
        if not is_authorized:
            raise CouponNotHolder(developer_message="User is not the holder of this coupon.")
        
        data = {
            "id": coupon.id,
            "store_name": coupon.store.name,
            "store_id": coupon.store.id,
            "store_location": {
                "lat": coupon.store.lat,
                "lng": coupon.store.lng
            },
            "address": coupon.store.address,
            "coupon_name": coupon.coupon_name,
            "coupon_detail": coupon.coupon_detail,
            "important_notes": coupon.important_notes,
            "start_date": coupon.start_date,
            "expiry_date": coupon.expiry_date,
            "coupon_type": coupon.coupon_type,
            "image_url": coupon.image_url,
            "template_id": coupon.template.id if coupon.template else None,  # Add template_id
            "redeem_code": coupon.redeem_code,
            "is_redeemed": is_redeemed,
            "original_owner_email": coupon.original_owner.email if coupon.original_owner else None,
            "last_holder_email": coupon.last_holder.email if coupon.last_holder else None,
            "estimated_savings": coupon.estimated_savings,
            "can_use_today": True,
            "tags": [tag.display_name for tag in coupon.tags.all()],  # 返回標籤的顯示名稱
            "merchant_deleted": coupon.store.owner is None,
            "acquisition_method": coupon.acquisition_method,
        }
    
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def redeem_coupon(request, id):
    coupon = get_object_or_404(
        Coupon.objects.select_related('store', 'template', 'original_owner'),
        id=id,
    )

    if coupon.coupon_type == 'exclusive':
        # === 專屬優惠券（需要兌換碼） ===

        if coupon.is_redeemed():
            raise CouponAlreadyRedeemed(developer_message="This coupon has already been redeemed.")

        if coupon.current_holder != request.user:
            raise CouponNotHolder(developer_message="User is not the holder of this coupon.")

        submitted_code = request.data.get('redeem_code')
        if not submitted_code:
            raise RedeemCodeInvalid(developer_message="Redeem code is required.")

        parsed_web_table_qr = _parse_web_table_qr_payload(submitted_code)

        # App-user table QR flow: allow redeem by scanned table token,
        # but enforce token belongs to the same store as the coupon.
        if parsed_web_table_qr is not None:
            qr_kind, qr_token = parsed_web_table_qr
            if qr_kind == 'fixed':
                fixed_session = StoreFixedSession.objects.filter(
                    session_token__iexact=qr_token,
                    is_active=True,
                ).select_related('store').first()
                if not fixed_session or fixed_session.store_id != coupon.store_id:
                    raise RedeemCodeInvalid(developer_message="Invalid redeem code.")
            else:
                qr_session = QRCodeSession.objects.filter(
                    session_token__iexact=qr_token,
                    is_active=True,
                ).select_related('template__store').first()
                if not qr_session or qr_session.template.store_id != coupon.store_id:
                    raise RedeemCodeInvalid(developer_message="Invalid redeem code.")
        else:
            # Determine whether the submitted code is a 6-digit unified store code.
            # Run a single Store lookup and cache the result to avoid a duplicate query later.
            _unified_store: Store | None = None
            if len(submitted_code) == 6 and submitted_code.isdigit():
                try:
                    _unified_store = Store.objects.get(unified_redeem_code=submitted_code)
                    if _unified_store.id != coupon.store.id:
                        raise UnifiedCodeInvalid(developer_message="Unified code does not match coupon's store.")
                except Store.DoesNotExist:
                    pass  # Not a unified code — fall through to coupon-specific validation

            is_unified = _unified_store is not None and _unified_store.id == coupon.store.id

            if not is_unified:
                # Coupon-specific code validation:
                # prefer coupon.redeem_code; fall back to template_redeem_code
                expected_code = coupon.redeem_code or (
                    coupon.template.template_redeem_code if coupon.template else None
                )
                if not expected_code:
                    raise RedeemCodeInvalid(developer_message="This coupon has no redeem code configured.")
                if expected_code != submitted_code:
                    raise RedeemCodeInvalid(developer_message="Invalid redeem code.")

    elif coupon.coupon_type == 'store':
        pass
    else:
        raise CouProAPIException(developer_message="Unsupported coupon type.")

    # 建立兌換記錄（適用於兩種類型）
    savings_amount = coupon.estimated_savings or 0

    try:
        redemption = CouponRedemption(
            coupon=coupon,
            user=request.user,
            savings_amount=savings_amount,
            coupon_type=coupon.coupon_type,
        )
        redemption.save()
    except IntegrityError:
        raise CouponAlreadyRedeemed(
            developer_message="This coupon has already been redeemed by this user."
        )
    except ValueError:
        raise CouponAlreadyRedeemed(developer_message="This coupon has already been redeemed by this user.")

    # 更新用戶統計資料
    try:
        student_profile = request.user.student_profile
        student_profile.update_monthly_savings()
        StudentProfile.objects.filter(pk=student_profile.pk).update(
            coupons_used_count=F('coupons_used_count') + 1,
            total_savings=F('total_savings') + savings_amount,
            monthly_savings=F('monthly_savings') + savings_amount,
        )
        student_profile.refresh_from_db()
    except (StudentProfile.DoesNotExist, AttributeError):
        pass

    # === Progress Tracker updates (011-progress-tracker) ===
    if coupon.coupon_type == 'exclusive':
        original_owner = coupon.original_owner
        is_shared_redemption = (original_owner is not None and original_owner != request.user)

        # Metric 2 — redeemer gets +1 for ANY exclusive coupon redemption.
        increment_sharing_progress_for_redeemer(request.user)

        if is_shared_redemption:
            # Metric 2 — original owner gets +1 when their coupon is redeemed by someone else.
            increment_sharing_progress_for_redeemer(original_owner)

        # Metric 3 — first-ever exclusive redemption triggers referral reward for original owner.
        try:
            exclusive_count = CouponRedemption.objects.filter(
                user=request.user, coupon_type='exclusive'
            ).count()
            voucher_count = PlatformVoucherRedemption.objects.filter(
                user=request.user
            ).count()
            is_first_redemption = (exclusive_count == 1 and voucher_count == 0)
            if is_first_redemption and original_owner and original_owner != request.user:
                apply_referral_reward(original_owner)
        except Exception:
            pass

    return Response({
        "message": "優惠券兌換成功",
        "coupon_name": coupon.coupon_name,
        "coupon_detail": coupon.coupon_detail,
        "savings_amount": savings_amount,
        "redeemed_at": redemption.redeemed_at.isoformat(),
        "redemption_id": redemption.id,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def validate_unified_redemption_code(request, code):
    """
    Validate unified redemption code and return store info + consumer's available coupons.
    
    Args:
        code: 6-digit unified redemption code
        
    Returns:
        Store information and list of available coupons for the authenticated consumer
    """
    logger = logging.getLogger(__name__)
    # Validate code format (6 digits)
    if not code or len(code) != 6 or not code.isdigit():
        # Log invalid format attempt using Python logging (goes to Sentry)
        if request.user.is_authenticated:
            logger.warning(
                "Unified redemption code validation failed: invalid format",
                extra={
                    "user_id": request.user.id,
                    "username": request.user.username,
                    "email": request.user.email,
                    "action": "validate_unified_redemption_code_failed",
                },
            )
        raise CouProAPIException(developer_message="Invalid unified code format.")
    
    # Find store with matching unified_redeem_code
    try:
        store = Store.objects.get(unified_redeem_code=code)
    except Store.DoesNotExist:
        if request.user.is_authenticated:
            logger.warning(
                "Unified redemption code validation failed: code not found",
                extra={
                    "user_id": request.user.id,
                    "username": request.user.username,
                    "email": request.user.email,
                    "action": "validate_unified_redemption_code_failed",
                },
            )
        raise UnifiedCodeInvalid(developer_message="Unified code not found.")
    
    # Get consumer's available coupons for this store.
    # Use Exists() annotation to check redemption status in a single query instead of
    # calling coupon.is_redeemed() per coupon (which would cause N+1 queries).
    now = timezone.now()
    available_coupons = Coupon.objects.filter(
        store=store,
        coupon_type='exclusive',
        current_holder=request.user,
        expiry_date__gt=now,
        start_date__lte=now,
    ).annotate(
        _is_redeemed=Exists(CouponRedemption.objects.filter(coupon=OuterRef('pk')))
    ).select_related('store', 'template').prefetch_related('tags')

    # Format coupon data — use annotated _is_redeemed to avoid extra DB hits
    coupon_data = []
    for coupon in available_coupons:
        if not coupon._is_redeemed:
            coupon_data.append({
                "id": coupon.id,
                "coupon_name": coupon.coupon_name,
                "coupon_detail": coupon.coupon_detail,
                "coupon_type": coupon.coupon_type,
                "store_name": store.name,
                "expiry_date": coupon.expiry_date.isoformat(),
                "estimated_savings": float(coupon.estimated_savings) if coupon.estimated_savings else 0,
                "is_redeemed": False,
                "image_url": coupon.image_url,
            })

    # Platform vouchers: only when store participates
    available_platform_vouchers = []
    if getattr(store, "accepts_platform_vouchers", False):
        from ..models import PlatformVoucherRedemption
        redeemed_voucher_ids = PlatformVoucherRedemption.objects.values_list("voucher_id", flat=True)
        platform_vouchers = PlatformVoucher.objects.filter(
            current_holder=request.user,
            expiry_date__gt=now,
            start_date__lte=now,
        ).exclude(id__in=redeemed_voucher_ids)
        for pv in platform_vouchers:
            available_platform_vouchers.append({
                "id": pv.id,
                "face_value": str(pv.face_value),
                "redeem_code": pv.redeem_code,
                "expiry_date": pv.expiry_date.isoformat(),
                "batch_name": pv.batch_name or "",
            })
    
    # Prepare response
    response_data = {
        "store": {
            "id": store.id,
            "name": store.name,
            "address": store.address,
        },
        "available_coupons": coupon_data,
        "available_platform_vouchers": available_platform_vouchers,
    }
    
    # Log successful validation
    if request.user.is_authenticated:
        logger.info(
            "Unified redemption code validation successful",
            extra={
                "user_id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "code": code,
                "action": "validate_unified_redemption_code_success",
                "store_id": store.id,
                "store_name": store.name,
                "available_coupons": len(coupon_data),
            }
        )
    
    serializer = UnifiedRedemptionValidateSerializer(response_data)
    return Response(serializer.data, status=status.HTTP_200_OK)
