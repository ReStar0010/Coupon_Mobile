from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Count, Sum

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from ..models import MerchantProfile, Store, CouponTemplate, Coupon, CouponRedemption, Log
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

