from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Count, Sum, Q, F
from datetime import timedelta, datetime
import math

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from ..models import MerchantProfile, Store, CouponTemplate, Coupon, CouponRedemption, Log, CouponShareRequest
from ..serializers import MerchantProfileSerializer, StoreSerializer


def get_merchant_store(user):
    """Get the store owned by the merchant user."""
    try:
        return Store.objects.get(owner=user)
    except Store.DoesNotExist:
        return None
    except Store.MultipleObjectsReturned:
        return Store.objects.filter(owner=user).first()


@swagger_auto_schema(
    method='get',
    operation_description="Get merchant profile and store information",
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_merchant_profile(request):
    """
    Get merchant profile and store information for the authenticated merchant.
    """
    user = request.user
    
    # Check if user is a merchant
    is_merchant = user.groups.filter(name='Merchants').exists()
    if not is_merchant:
        return Response({
            'error': 'User is not a merchant.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        merchant_profile = user.merchant_profile
    except MerchantProfile.DoesNotExist:
        return Response({
            'error': 'Merchant profile not found.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    store = get_merchant_store(user)
    
    response_data = {
        'merchant': {
            'id': merchant_profile.id,
            'email': user.email,
            'phone': merchant_profile.phone,
            'contact_person': merchant_profile.contact_person,
            'contact_info': merchant_profile.contact_info,
        }
    }
    
    if store:
        response_data['store'] = {
            'id': store.id,
            'name': store.name,
            'address': store.address,
            'lat': store.lat,
            'lng': store.lng,
            'business_hours': store.business_hours,
            'image_url': store.image_url,
            'store_type': store.store_type,
        }
    
    return Response(response_data, status=status.HTTP_200_OK)


@swagger_auto_schema(
    method='put',
    operation_description="Update merchant profile and store information",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'phone': openapi.Schema(type=openapi.TYPE_STRING),
            'contact_person': openapi.Schema(type=openapi.TYPE_STRING),
            'contact_info': openapi.Schema(type=openapi.TYPE_STRING),
            'store_name': openapi.Schema(type=openapi.TYPE_STRING),
            'store_address': openapi.Schema(type=openapi.TYPE_STRING),
            'store_lat': openapi.Schema(type=openapi.TYPE_NUMBER),
            'store_lng': openapi.Schema(type=openapi.TYPE_NUMBER),
            'business_hours': openapi.Schema(type=openapi.TYPE_STRING),
            'image_url': openapi.Schema(type=openapi.TYPE_STRING),
            'store_type': openapi.Schema(type=openapi.TYPE_STRING, enum=['restaurant', 'retail', 'service', 'entertainment', 'beauty', 'education', 'medical', 'other']),
        }
    ),
)
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_merchant_profile(request):
    """
    Update merchant profile and store information.
    """
    user = request.user
    
    # Check if user is a merchant
    is_merchant = user.groups.filter(name='Merchants').exists()
    if not is_merchant:
        return Response({
            'error': 'User is not a merchant.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        merchant_profile = user.merchant_profile
    except MerchantProfile.DoesNotExist:
        return Response({
            'error': 'Merchant profile not found.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    data = request.data
    
    # Update merchant profile
    if 'phone' in data:
        merchant_profile.phone = data['phone']
    if 'contact_person' in data:
        merchant_profile.contact_person = data['contact_person']
    if 'contact_info' in data:
        merchant_profile.contact_info = data['contact_info']
    merchant_profile.save()
    
    # Update store if it exists
    # Note: owner field is never updated - it's set during registration and remains unchanged
    store = get_merchant_store(user)
    if store:
        # Ensure owner is not modified (security measure)
        # Only update allowed fields
        if 'store_name' in data:
            store.name = data['store_name']
        if 'store_address' in data:
            store.address = data['store_address']
        if 'store_lat' in data:
            store.lat = data['store_lat']
        if 'store_lng' in data:
            store.lng = data['store_lng']
        if 'business_hours' in data:
            store.business_hours = data['business_hours']
        if 'image_url' in data:
            store.image_url = data['image_url']
        if 'store_type' in data:
            store.store_type = data['store_type']
        # Owner is never updated - it's always the authenticated user
        store.save()
    
    response_data = {
        'message': 'Profile updated successfully',
        'merchant': {
            'id': merchant_profile.id,
            'phone': merchant_profile.phone,
            'contact_person': merchant_profile.contact_person,
            'contact_info': merchant_profile.contact_info,
        }
    }
    
    if store:
        response_data['store'] = {
            'id': store.id,
            'name': store.name,
            'address': store.address,
            'lat': store.lat,
            'lng': store.lng,
            'business_hours': store.business_hours,
            'image_url': store.image_url,
            'store_type': store.store_type,
        }
    
    return Response(response_data, status=status.HTTP_200_OK)


@swagger_auto_schema(
    method='get',
    operation_description="Get merchant statistics (coupon count, total redemptions, total views)",
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_merchant_statistics(request):
    """
    Get merchant statistics including:
    - Number of active coupon templates
    - Total number of redemptions
    - Total number of views/exposures
    """
    user = request.user
    
    # Check if user is a merchant
    is_merchant = user.groups.filter(name='Merchants').exists()
    if not is_merchant:
        return Response({
            'error': 'User is not a merchant.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    store = get_merchant_store(user)
    if not store:
        return Response({
            'error': 'No store found for this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Count active coupon templates
    active_templates_count = CouponTemplate.objects.filter(
        store=store,
        is_active=True
    ).count()
    
    # Count total redemptions (from all coupons generated from templates)
    total_redemptions = CouponRedemption.objects.filter(
        coupon__store=store
    ).count()
    
    # Count total views/exposures (from Log entries)
    total_views = Log.objects.filter(
        coupon__store=store,
        action='view'
    ).count()
    
    # Additional statistics
    total_templates = CouponTemplate.objects.filter(store=store).count()
    total_coupons_generated = Coupon.objects.filter(
        store=store,
        template__isnull=False
    ).count()
    
    return Response({
        'active_coupons': active_templates_count,
        'total_redemptions': total_redemptions,
        'total_views': total_views,
        'total_templates': total_templates,
        'total_coupons_generated': total_coupons_generated,
    }, status=status.HTTP_200_OK)


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points on Earth (in meters)
    using the Haversine formula.
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    
    # Radius of Earth in meters
    R = 6371000
    
    # Convert latitude and longitude from degrees to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance


@swagger_auto_schema(
    method='get',
    operation_description="Get merchant analytics including GMV, stranger acquisition ratio, coupon activation rate, etc.",
    manual_parameters=[
        openapi.Parameter('days', openapi.IN_QUERY, description="Time range in days (7, 30, or 90)", type=openapi.TYPE_INTEGER, default=30),
    ],
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_merchant_analytics(request):
    """
    Get comprehensive merchant analytics including:
    1. GMV (Gross Merchandise Value)
    2. Stranger Acquisition Ratio (陌生獲客比)
    3. Coupon Activation Rate (優惠券活化率)
    4. Local Conversion Rate (在地轉換率)
    5. Overall Conversion Rate (總體轉換率)
    6. Redemption Rate (核銷率)
    7. User Transfer Ranking (用戶轉贈總數排行榜)
    8. Stranger Acquisition Trend (陌生獲客比趨勢)
    """
    user = request.user
    
    # Check if user is a merchant
    is_merchant = user.groups.filter(name='Merchants').exists()
    if not is_merchant:
        return Response({
            'error': 'User is not a merchant.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    store = get_merchant_store(user)
    if not store:
        return Response({
            'error': 'No store found for this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Get time range parameter (default 30 days)
    days = int(request.query_params.get('days', 30))
    if days not in [7, 30, 90]:
        days = 30
    
    now = timezone.now()
    time_threshold = now - timedelta(days=days)
    
    # Fixed distance radius in meters (500 meters = 0.5 km)
    DISTANCE_RADIUS = 500
    
    # Base querysets filtered by store
    store_coupons = Coupon.objects.filter(store=store)
    store_redemptions = CouponRedemption.objects.filter(coupon__store=store)
    store_logs = Log.objects.filter(coupon__store=store)
    
    # Only calculate redemption-related metrics for exclusive coupons (EasyUse/store type doesn't track redemptions)
    exclusive_redemptions = store_redemptions.filter(coupon__coupon_type='exclusive')
    exclusive_redemptions_count = exclusive_redemptions.count()
    
    # 1. GMV = 總核銷數 × 平均客單價 (only exclusive redemptions)
    average_order_value = store.average_order_value or 0
    gmv = float(exclusive_redemptions_count * average_order_value) if average_order_value else 0
    
    # 2. 陌生獲客比 = (總核銷數 - 原始擁有者核銷數) / 總核銷數
    # Only for exclusive coupons
    if exclusive_redemptions_count > 0:
        original_owner_redemptions = exclusive_redemptions.filter(
            user=F('coupon__original_owner')
        ).count()
        stranger_acquisition_ratio = (exclusive_redemptions_count - original_owner_redemptions) / exclusive_redemptions_count
    else:
        stranger_acquisition_ratio = 0
    
    # 3. 優惠券活化率 = 轉手次數 ≥ 1 的核銷券數 / 總核銷券數（distinct coupons）
    # Only for exclusive coupons
    if exclusive_redemptions_count > 0:
        # Get all redeemed exclusive coupons (distinct)
        redeemed_exclusive_coupons = exclusive_redemptions.values_list('coupon', flat=True).distinct()
        total_redeemed_coupons_count = len(redeemed_exclusive_coupons)
        
        # Count coupons with transfer count >= 1
        activated_coupons_count = 0
        for coupon_id in redeemed_exclusive_coupons:
            transfer_count = CouponShareRequest.objects.filter(
                coupon_id=coupon_id,
                status='accepted'
            ).count()
            if transfer_count >= 1:
                activated_coupons_count += 1
        
        coupon_activation_rate = activated_coupons_count / total_redeemed_coupons_count if total_redeemed_coupons_count > 0 else 0
    else:
        coupon_activation_rate = 0
    
    # 4. 在地轉換率 = 近時間核銷數 / 近地點點擊數
    # 近時間核銷數：在固定距離內且最近一段時間內的核銷數
    # 近地點點擊數：在固定距離內的點擊數
    store_lat = store.lat
    store_lng = store.lng
    
    # Get redemptions within distance and time range (only exclusive)
    nearby_recent_redemptions = exclusive_redemptions.filter(
        redeemed_at__gte=time_threshold
    )
    
    nearby_recent_redemptions_count = 0
    if store_lat and store_lng:
        for redemption in nearby_recent_redemptions:
            if redemption.lat and redemption.lng:
                distance = haversine_distance(store_lat, store_lng, redemption.lat, redemption.lng)
                if distance and distance <= DISTANCE_RADIUS:
                    nearby_recent_redemptions_count += 1
    
    # Get clicks within distance
    nearby_clicks = store_logs.filter(action='view')
    nearby_clicks_count = 0
    if store_lat and store_lng:
        for log in nearby_clicks:
            if log.lat and log.lng:
                distance = haversine_distance(store_lat, store_lng, log.lat, log.lng)
                if distance and distance <= DISTANCE_RADIUS:
                    nearby_clicks_count += 1
    
    if nearby_clicks_count > 0:
        local_conversion_rate = nearby_recent_redemptions_count / nearby_clicks_count
    else:
        local_conversion_rate = None  # Data insufficient
    
    # 5. 總體轉換率 = 總核銷數 / 總點擊數 (only exclusive redemptions)
    total_clicks = store_logs.filter(action='view').count()
    if total_clicks > 0:
        overall_conversion_rate = exclusive_redemptions_count / total_clicks
    else:
        overall_conversion_rate = 0
    
    # 6. 核銷率 = 總核銷數 / 優惠券總數 (only exclusive coupons)
    exclusive_coupons = store_coupons.filter(coupon_type='exclusive')
    total_coupons = exclusive_coupons.count()
    if total_coupons > 0:
        redemption_rate = exclusive_redemptions_count / total_coupons
    else:
        redemption_rate = 0
    
    # 7. 用戶轉贈總數排行榜
    # Only for exclusive coupons from this store
    exclusive_coupons = store_coupons.filter(coupon_type='exclusive')
    transfer_ranking = CouponShareRequest.objects.filter(
        coupon__in=exclusive_coupons,
        status='accepted'
    ).values('from_user__email', 'from_user__id').annotate(
        transfer_count=Count('id')
    ).order_by('-transfer_count')[:10]
    
    ranking_list = []
    for item in transfer_ranking:
        email = item['from_user__email']
        # Mask email for privacy
        if email:
            parts = email.split('@')
            if len(parts) == 2:
                masked_email = f"{parts[0][:3]}***@{parts[1]}"
            else:
                masked_email = "***"
        else:
            masked_email = "***"
        
        ranking_list.append({
            'user_id': item['from_user__id'],
            'email': masked_email,
            'transfer_count': item['transfer_count']
        })
    
    # 8. Calculate trend data for all metrics (daily data)
    daily_data = []
    current_date = time_threshold.date()
    end_date = now.date()
    
    # Initialize trend data structures
    stranger_trend_data = []
    gmv_trend_data = []
    activation_trend_data = []
    local_conversion_trend_data = []
    overall_conversion_trend_data = []
    redemption_trend_data = []
    
    while current_date <= end_date:
        day_start = timezone.make_aware(datetime.combine(current_date, datetime.min.time()))
        day_end = day_start + timedelta(days=1)
        
        # Daily exclusive redemptions (only exclusive type for redemption metrics)
        day_exclusive_redemptions = exclusive_redemptions.filter(
            redeemed_at__gte=day_start,
            redeemed_at__lt=day_end
        )
        day_exclusive_count = day_exclusive_redemptions.count()
        
        # Daily clicks
        day_clicks = store_logs.filter(
            action='view',
            timestamp__gte=day_start,
            timestamp__lt=day_end
        )
        day_clicks_count = day_clicks.count()
        
        # 1. GMV trend (only exclusive redemptions)
        day_gmv = float(day_exclusive_count * average_order_value) if average_order_value else 0
        gmv_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_gmv
        })
        
        # 2. Stranger acquisition ratio trend
        if day_exclusive_count > 0:
            day_original_owner_count = day_exclusive_redemptions.filter(
                user=F('coupon__original_owner')
            ).count()
            day_stranger_ratio = (day_exclusive_count - day_original_owner_count) / day_exclusive_count
        else:
            day_stranger_ratio = 0
        stranger_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_stranger_ratio
        })
        
        # 3. Coupon activation rate trend
        if day_exclusive_count > 0:
            day_activated_count = 0
            redeemed_coupon_ids = day_exclusive_redemptions.values_list('coupon', flat=True).distinct()
            day_total_redeemed_coupons = len(redeemed_coupon_ids)
            for coupon_id in redeemed_coupon_ids:
                transfer_count = CouponShareRequest.objects.filter(
                    coupon_id=coupon_id,
                    status='accepted'
                ).count()
                if transfer_count >= 1:
                    day_activated_count += 1
            day_activation_rate = day_activated_count / day_total_redeemed_coupons if day_total_redeemed_coupons > 0 else 0
        else:
            day_activation_rate = 0
        activation_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_activation_rate
        })
        
        # 4. Local conversion rate trend (only exclusive redemptions)
        day_nearby_recent_redemptions_count = 0
        day_nearby_clicks_count = 0
        if store_lat and store_lng:
            for redemption in day_exclusive_redemptions:
                if redemption.lat and redemption.lng:
                    distance = haversine_distance(store_lat, store_lng, redemption.lat, redemption.lng)
                    if distance and distance <= DISTANCE_RADIUS:
                        day_nearby_recent_redemptions_count += 1
            
            for log in day_clicks:
                if log.lat and log.lng:
                    distance = haversine_distance(store_lat, store_lng, log.lat, log.lng)
                    if distance and distance <= DISTANCE_RADIUS:
                        day_nearby_clicks_count += 1
        
        if day_nearby_clicks_count > 0:
            day_local_conversion = day_nearby_recent_redemptions_count / day_nearby_clicks_count
        else:
            day_local_conversion = None
        local_conversion_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_local_conversion
        })
        
        # 5. Overall conversion rate trend (only exclusive redemptions)
        if day_clicks_count > 0:
            day_overall_conversion = day_exclusive_count / day_clicks_count
        else:
            day_overall_conversion = 0
        overall_conversion_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_overall_conversion
        })
        
        # 6. Redemption rate trend (only exclusive coupons)
        # Use exclusive coupons that have started by this day (start_date <= day_end)
        total_exclusive_coupons_at_day = exclusive_coupons.filter(start_date__lte=day_end).count()
        if total_exclusive_coupons_at_day > 0:
            day_redemption_rate = day_exclusive_count / total_exclusive_coupons_at_day
        else:
            day_redemption_rate = 0
        redemption_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_redemption_rate
        })
        
        current_date += timedelta(days=1)
    
    # Calculate averages for all trends
    def calculate_average(trend_data):
        valid_values = [d['value'] for d in trend_data if d['value'] is not None]
        return sum(valid_values) / len(valid_values) if valid_values else 0
    
    stranger_avg = calculate_average(stranger_trend_data)
    gmv_avg = calculate_average(gmv_trend_data)
    activation_avg = calculate_average(activation_trend_data)
    local_conversion_avg = calculate_average([d for d in local_conversion_trend_data if d['value'] is not None])
    overall_conversion_avg = calculate_average(overall_conversion_trend_data)
    redemption_avg = calculate_average(redemption_trend_data)
    
    return Response({
        'gmv': gmv,
        'stranger_acquisition_ratio': stranger_acquisition_ratio,
        'coupon_activation_rate': coupon_activation_rate,
        'local_conversion_rate': local_conversion_rate,
        'overall_conversion_rate': overall_conversion_rate,
        'redemption_rate': redemption_rate,
        'transfer_ranking': ranking_list,
        'trends': {
            'gmv': {
                'current': gmv,
                'average': gmv_avg,
                'daily_data': gmv_trend_data
            },
            'stranger_acquisition_ratio': {
                'current': stranger_acquisition_ratio,
                'average': stranger_avg,
                'daily_data': stranger_trend_data
            },
            'coupon_activation_rate': {
                'current': coupon_activation_rate,
                'average': activation_avg,
                'daily_data': activation_trend_data
            },
            'local_conversion_rate': {
                'current': local_conversion_rate,
                'average': local_conversion_avg if local_conversion_rate is not None else None,
                'daily_data': local_conversion_trend_data
            },
            'overall_conversion_rate': {
                'current': overall_conversion_rate,
                'average': overall_conversion_avg,
                'daily_data': overall_conversion_trend_data
            },
            'redemption_rate': {
                'current': redemption_rate,
                'average': redemption_avg,
                'daily_data': redemption_trend_data
            }
        },
        # Keep backward compatibility
        'stranger_acquisition_trend': {
            'current': stranger_acquisition_ratio,
            'average': stranger_avg,
            'daily_data': stranger_trend_data
        }
    }, status=status.HTTP_200_OK)


@swagger_auto_schema(
    method='put',
    operation_description="Update average order value for GMV calculation",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'average_order_value': openapi.Schema(type=openapi.TYPE_NUMBER, description="Average order value in TWD"),
        },
        required=['average_order_value']
    ),
)
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_average_order_value(request):
    """
    Update the average order value for the merchant's store.
    """
    user = request.user
    
    # Check if user is a merchant
    is_merchant = user.groups.filter(name='Merchants').exists()
    if not is_merchant:
        return Response({
            'error': 'User is not a merchant.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    store = get_merchant_store(user)
    if not store:
        return Response({
            'error': 'No store found for this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    data = request.data
    average_order_value = data.get('average_order_value')
    
    if average_order_value is None:
        return Response({
            'error': 'average_order_value is required.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        average_order_value = float(average_order_value)
        if average_order_value < 0:
            return Response({
                'error': 'average_order_value must be a positive number.'
            }, status=status.HTTP_400_BAD_REQUEST)
    except (ValueError, TypeError):
        return Response({
            'error': 'average_order_value must be a valid number.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    store.average_order_value = average_order_value
    store.save()
    
    return Response({
        'message': 'Average order value updated successfully',
        'average_order_value': float(store.average_order_value)
    }, status=status.HTTP_200_OK)

