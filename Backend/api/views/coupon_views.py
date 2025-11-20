from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Count
from drf_yasg.utils import swagger_auto_schema

from ..serializers import RedeemCouponSerializer
from ..models import Coupon, Log, StudentProfile, CouponRedemption

@api_view(['GET'])
@permission_classes([AllowAny])  # 允許匿名訪問
def get_store_coupons(request):
    """
    Get type A coupons (store coupons) that are available to all users.
    These are the general "identification" coupons that can be used multiple times.
    """
    # Track view easy use page event
    if request.user.is_authenticated:
        Log.objects.create(action="view EasyUse", user=request.user)

    now = timezone.now()

    # 查詢：未過期、已開始的 store type coupon
    store_coupons = Coupon.objects.filter(
        coupon_type='store',
        expiry_date__gt=now,
        start_date__lte=now
    ).select_related('store').prefetch_related('tags')  # Optimize DB query
    
    # 取得這些 coupon 關聯的所有 store IDs
    store_ids = store_coupons.values_list('store_id', flat=True).distinct()

    # 計算每個 store 的有效 coupon 數量
    active_counts = Coupon.objects.filter(
        store_id__in=store_ids,
        coupon_type='store',
        expiry_date__gt=now,
        start_date__lte=now
    ).values('store_id').annotate(active_coupon_count=Count('id'))

    # 將數量轉換為字典方便查找 {store_id: count}
    active_counts_dict = {item['store_id']: item['active_coupon_count'] for item in active_counts}

    data = []
    for c in store_coupons:
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
            "total_redemptions": c.get_redemption_count(),
            "unique_users": c.get_unique_users_count(),
            "tags": [tag.display_name for tag in c.tags.all()]  # 返回標籤的顯示名稱
        })
    
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])  # 需要身份驗證，因為這是個人專屬優惠
def get_exclusive_coupons(request):
    """
    Get type B coupons (exclusive coupons) that belong to the authenticated user.
    These are coupons received by drawing or shared from others.
    """
    # Track view easy use page event
    if request.user.is_authenticated:
        Log.objects.create(action="view Collection", user=request.user)

    now = timezone.now()

    # 查詢：未過期、已開始，且屬於當前用戶的專屬優惠券
    # 包括用戶是原始擁有者或當前持有者的券
    exclusive_coupons = Coupon.objects.filter(
        coupon_type='exclusive',
        expiry_date__gt=now,
        start_date__lte=now, 
        current_holder=request.user,  # 當前持有者是請求的用戶
    ).select_related('store', 'template').prefetch_related('tags')  # Optimize DB query
    
    # Filter out redeemed coupons
    unredeemed_coupons = []
    for coupon in exclusive_coupons:
        if not coupon.is_redeemed():
            unredeemed_coupons.append(coupon)
    
    exclusive_coupons = unredeemed_coupons
    
    # 檢查這些券是否已被兌換
    data = []
    for c in exclusive_coupons:

        # 使用方法確認券是否已被兌換（基於 CouponRedemption 表）
        is_redeemed = c.is_redeemed()
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
            "tags": [tag.display_name for tag in c.tags.all()]  # 返回標籤的顯示名稱
        })
    
    return Response(data)

@api_view(['GET'])
@permission_classes([AllowAny])  # 明確允許匿名訪問
def get_coupon_detail(request, id):

    now = timezone.now()
    coupon = get_object_or_404(Coupon.objects.select_related('store').prefetch_related('tags'), id=id) 
    
    if request.user.is_authenticated:
        Log.objects.create(action="view coupon", user=request.user, coupon=coupon)
    
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
            "total_redemptions": coupon.get_redemption_count(),
            "unique_users": coupon.get_unique_users_count(),
            "can_use_today": can_use_today,
            "tags": [tag.display_name for tag in coupon.tags.all()]  # 返回標籤的顯示名稱
        }

    else:
        # Type B: Exclusive coupon (專屬優惠券)
        
        # 檢查此 coupon 是否已被兌換
        is_redeemed = coupon.is_redeemed()
        
        # 檢查請求用戶是否有權查看此優惠券的詳細信息
        is_authorized = request.user.is_authenticated and coupon.current_holder == request.user
        
        # 如果未登錄或不是券的持有者，返回有限信息
        if not is_authorized:
            return Response({
                "error": "您沒有權限查看此優惠券的詳細信息",
                "coupon_name": coupon.coupon_name,
                "store_name": coupon.store.name
            }, status=status.HTTP_403_FORBIDDEN)
        
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
            "redeem_code": coupon.redeem_code,
            "is_redeemed": is_redeemed,
            "original_owner_email": coupon.original_owner.email if coupon.original_owner else None,
            "last_holder_email": coupon.last_holder.email if coupon.last_holder else None,
            "estimated_savings": coupon.estimated_savings,
            "can_use_today": True,
            "tags": [tag.display_name for tag in coupon.tags.all()]  # 返回標籤的顯示名稱
        }
    
    return Response(data)

@swagger_auto_schema(
        method='post',
        operation_description="Redeem a coupon by its ID",
        request_body=RedeemCouponSerializer
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def redeem_coupon(request, id):
    coupon = get_object_or_404(Coupon, id=id)

    # 檢查優惠券類型，處理方式不同
    if coupon.coupon_type == 'exclusive':
        # === 專屬優惠券（需要兌換碼） ===
        
        # 檢查是否已被兌換
        if coupon.is_redeemed():
            return Response({"error": "此優惠券已被兌換"}, status=status.HTTP_400_BAD_REQUEST)

        # 檢查用戶是否為優惠券持有者
        if coupon.current_holder != request.user:
            return Response({"error": "您不是此優惠券的持有者"}, status=status.HTTP_403_FORBIDDEN)
        
        # 檢查兌換碼
        submitted_code = request.data.get('redeem_code')
        if not submitted_code:
            return Response({"error": "兌換碼為必填項目"}, status=status.HTTP_400_BAD_REQUEST)

        # 驗證兌換碼 
        # ADD: check template redeem code, exclusive coupon redeem code is not NONE
        if coupon.template.template_redeem_code != submitted_code: 
            return Response({"error": "無效的兌換碼"}, status=status.HTTP_400_BAD_REQUEST)
            
    elif coupon.coupon_type == 'store':
        pass
    else:
        # 不支援的優惠券類型
        return Response({"error": "不支援的優惠券類型"}, status=status.HTTP_400_BAD_REQUEST)
    
    # 建立兌換記錄（適用於兩種類型）
    savings_amount = coupon.estimated_savings or 0
    
    # 創建 CouponRedemption 記錄
    try:
        redemption = CouponRedemption(
            coupon=coupon,
            user=request.user,
            savings_amount=savings_amount,
            coupon_type=coupon.coupon_type  # 設置 coupon_type 用於條件約束
        )
        redemption.save()
    except ValueError as e:
        # 處理 exclusive coupon 已被此用戶兌換的情況
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    # 更新用戶統計資料
    try:
        student_profile = request.user.student_profile
        
        # 檢查是否需要重設月度統計 (新月份)
        student_profile.update_monthly_savings()
        
        # 更新優惠券使用統計
        student_profile.coupons_used_count += 1
        
        # 更新總節省和月度節省
        student_profile.total_savings += savings_amount
        student_profile.monthly_savings += savings_amount
        student_profile.save()
        
    except (StudentProfile.DoesNotExist, AttributeError):
        # 處理用戶沒有學生檔案的情況
        pass
        
    # 記錄兌換活動
    Log.objects.create(action="redeem", user=request.user, coupon=coupon)
    
    return Response({
        "message": "優惠券兌換成功", 
        "coupon_detail": coupon.coupon_detail,
        "savings_amount": savings_amount,
    })
