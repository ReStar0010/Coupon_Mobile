from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
import secrets
import os
from pathlib import Path
from datetime import datetime

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from ..models import Coupon, CouponShareRequest, Log, StudentProfile, CouponTemplate, Store, Tag, CouponRedemption
from ..serializers import ConsolidateCouponSerializer, RefreshRedeemCodeSerializer, CouponTemplateSerializer, MerchantRedeemSerializer, UnifiedRedemptionCodeSerializer
from ..utils import generate_unified_redemption_code
from django.db.models import Count, F
from datetime import timedelta, datetime
import math


@swagger_auto_schema(
    method='post',
    operation_description="Send coupon to user via phone number (registered or pending)",
    request_body=ConsolidateCouponSerializer,
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])  # T014: Changed from AllowAny to IsAuthenticated
def merchant_consolidate_coupon(request):
    """
    Merchant sends coupon to user via phone number.
    - If phone is registered: Coupon is immediately assigned to the user
    - If phone is not registered: Coupon is created as "pending" and auto-assigned when user registers
    """
    from ..utils import validate_phone_number, mask_phone_number
    
    serializer = ConsolidateCouponSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    template_id = serializer.validated_data['template_id'] # type: ignore
    phone_number_raw = serializer.validated_data['phone_number'] # type: ignore
    
    # T015: Verify merchant owns this template's store
    store = get_merchant_store(request.user)
    if not store:
        return Response({
            'error': 'No store found for this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Validate and normalize phone number
    try:
        phone_number = validate_phone_number(phone_number_raw)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    # T015: Check if the template exists AND belongs to merchant's store
    try:
        coupon_template = CouponTemplate.objects.get(
            id=template_id,
            store=store,  # T015: Ownership check
            is_active=True,
            remaining_quantity__gt=0
        )
    except CouponTemplate.DoesNotExist:
        return Response({
            'error': 'Coupon template not found or not available.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # T016 & T017: Try to find registered user, or create pending coupon
    try:
        # T016: Registered user - assign immediately
        user_profile = StudentProfile.objects.get(phone_number=phone_number)
        user = user_profile.user
        
        # Generate coupon and check if successful
        generated_coupon = coupon_template.generate_coupon(user)
        if not generated_coupon:
            return Response({
                'error': 'Failed to generate coupon. Template may be out of stock.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set acquisition method to 'consolidate' (電話歸戶)
        generated_coupon.acquisition_method = 'consolidate'
        generated_coupon.save()
        
        # Log the consolidation action
        Log.objects.create(
            user=user,
            coupon=generated_coupon,
            action='consolidate_coupon',
        )
        
        # T018: Return with recipient_status
        return Response({
            'message': 'Coupon consolidated successfully',
            'coupon_name': generated_coupon.coupon_name,
            'remaining_quantity': coupon_template.remaining_quantity,
            'recipient_status': 'registered'
        }, status=status.HTTP_201_CREATED)
        
    except StudentProfile.DoesNotExist:
        # T017: Unregistered phone - create pending coupon
        coupon = Coupon.objects.create(
            store=coupon_template.store,
            template=coupon_template,
            coupon_name=coupon_template.coupon_name,
            coupon_detail=coupon_template.coupon_detail,
            important_notes=coupon_template.important_notes,
            start_date=coupon_template.start_date,
            expiry_date=coupon_template.expiry_date,
            image_url=coupon_template.image_url,
            coupon_type='exclusive',
            estimated_savings=coupon_template.estimated_savings,
            acquisition_method='consolidate',
            pending_phone_number=phone_number,
            current_holder=None,
            original_owner=None,
        )
        coupon.tags.set(coupon_template.tags.all())
        
        # Decrement template quantity
        coupon_template.remaining_quantity -= 1
        if coupon_template.remaining_quantity <= 0:
            coupon_template.is_active = False
        coupon_template.save()
        
        # T018: Return with recipient_status and masked phone
        return Response({
            'message': 'Coupon created as pending. Will be assigned when user registers.',
            'coupon_name': coupon.coupon_name,
            'remaining_quantity': coupon_template.remaining_quantity,
            'recipient_status': 'pending',
            'pending_phone': mask_phone_number(phone_number)
        }, status=status.HTTP_200_OK)

@swagger_auto_schema(
        method='post',
        operation_description="Refresh the redeem code of a coupon template",
        request_body=RefreshRedeemCodeSerializer,
)
@api_view(['POST'])
@permission_classes([AllowAny]) #FIXME - @permission_classes([IsAuthenticated])
def refresh_redeem_code(request):
    """
    Refresh the redeem code of CouponTemplate
    
    DEPRECATED: This endpoint is deprecated in favor of the unified redemption flow.
    Individual coupon QR code generation has been removed from the UI (per FR-010).
    This endpoint may remain for backward compatibility but should not be used by new code.
    Merchants should use the unified redemption button on the coupon list page instead.
    """
    serializer = RefreshRedeemCodeSerializer(data=request.data)
    if serializer.is_valid():
        template_id = serializer.validated_data['template_id']
        new_redeem_code = serializer.validated_data['new_redeem_code']

        try:
            coupon_template = CouponTemplate.objects.get(id=template_id)
            coupon_template.template_redeem_code = new_redeem_code
            coupon_template.save()

            return Response({
                'message': 'Redeem code refreshed successfully',
                'new_redeem_code': new_redeem_code
            }, status=status.HTTP_200_OK)

        except CouponTemplate.DoesNotExist:
            return Response({
                'error': 'Coupon template does not exist.'
            }, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Helper function to check if user owns the store
def get_merchant_store(user):
    """Get the store owned by the merchant user."""
    try:
        return Store.objects.get(owner=user)
    except Store.DoesNotExist:
        return None
    except Store.MultipleObjectsReturned:
        # If multiple stores, return the first one
        return Store.objects.filter(owner=user).first()


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
    operation_description="List all coupon templates for the authenticated merchant",
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_coupon_templates(request):
    """
    List all coupon templates for the authenticated merchant's store.
    """
    store = get_merchant_store(request.user)
    if not store:
        return Response({
            'error': 'No store found for this merchant. Please create a store first.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    templates = CouponTemplate.objects.filter(store=store).order_by('-created_at')
    
    template_list = []
    for template in templates:
        template_data = {
            'id': template.id,
            'coupon_name': template.coupon_name,
            'coupon_detail': template.coupon_detail,
            'important_notes': template.important_notes,
            'image_url': template.image_url,
            'estimated_savings': float(template.estimated_savings) if template.estimated_savings else None,
            'template_redeem_code': template.template_redeem_code,
            'total_quantity': template.total_quantity,
            'remaining_quantity': template.remaining_quantity,
            'start_date': template.start_date.isoformat(),
            'end_date': template.expiry_date.isoformat(),
            'draw_probability': template.draw_probability,
            'is_active': template.is_active,
            'created_at': template.created_at.isoformat(),
            'tags': [tag.id for tag in template.tags.all()],
            'redemption_count': template.coupons.filter(coupon_type='exclusive').count(),
            # Only exclusive coupons (total_quantity > 0) can be sold out
            # Store coupons (total_quantity = 0) are always available
            'is_sold_out': template.total_quantity > 0 and template.remaining_quantity <= 0,
        }
        template_list.append(template_data)
    
    return Response(template_list, status=status.HTTP_200_OK)


@swagger_auto_schema(
    method='get',
    operation_description="Get a single coupon template by ID",
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_coupon_template(request, id):
    """
    Get a single coupon template by ID. Only accessible by the owner merchant.
    """
    store = get_merchant_store(request.user)
    if not store:
        return Response({
            'error': 'No store found for this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        template = CouponTemplate.objects.get(id=id, store=store)
    except CouponTemplate.DoesNotExist:
        return Response({
            'error': 'Coupon template not found or you do not have permission to access it.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    template_data = {
        'id': template.id,
        'store_id': template.store.id,
        'coupon_name': template.coupon_name,
        'coupon_detail': template.coupon_detail,
        'important_notes': template.important_notes,
        'image_url': template.image_url,
        'estimated_savings': float(template.estimated_savings) if template.estimated_savings else None,
        'template_redeem_code': template.template_redeem_code,
        'total_quantity': template.total_quantity,
        'remaining_quantity': template.remaining_quantity,
        'start_date': template.start_date.isoformat(),
        'end_date': template.expiry_date.isoformat(),
        'draw_probability': template.draw_probability,
        'is_active': template.is_active,
        'created_at': template.created_at.isoformat(),
        'tags': [tag.id for tag in template.tags.all()],
    }
    
    return Response(template_data, status=status.HTTP_200_OK)


@swagger_auto_schema(
    method='post',
    operation_description="Create a new coupon template",
    request_body=CouponTemplateSerializer,
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_coupon_template(request):
    """
    Create a new coupon template for the authenticated merchant's store.
    """
    store = get_merchant_store(request.user)
    if not store:
        return Response({
            'error': 'No store found for this merchant. Please create a store first.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    serializer = CouponTemplateSerializer(data=request.data)
    if serializer.is_valid():
        validated_data = serializer.validated_data
        
        # Create the template
        template = CouponTemplate.objects.create(
            store=store,
            coupon_name=validated_data['coupon_name'],
            coupon_detail=validated_data['coupon_detail'],
            important_notes=validated_data.get('important_notes', ''),
            image_url=validated_data.get('image_url', ''),
            estimated_savings=validated_data.get('estimated_savings'),
            template_redeem_code=validated_data.get('template_redeem_code'),
            total_quantity=validated_data['total_quantity'],
            remaining_quantity=validated_data['total_quantity'],
            start_date=validated_data['start_date'],
            expiry_date=validated_data['expiry_date'],
            draw_probability=validated_data.get('draw_probability', 0.5),
            is_active=validated_data.get('is_active', True),
        )
        
        # Set tags if provided
        if 'tags' in validated_data:
            tag_ids = validated_data['tags']
            tags = Tag.objects.filter(id__in=tag_ids)
            template.tags.set(tags)
        
        # If total_quantity is 0, this is a "一般" type coupon (EasyUse/store type)
        # Create a corresponding Coupon object for EasyUse page
        if validated_data['total_quantity'] == 0:
            coupon = Coupon.objects.create(
                store=store,
                template=template,
                coupon_name=template.coupon_name,
                coupon_detail=template.coupon_detail,
                important_notes=template.important_notes,
                start_date=template.start_date,
                expiry_date=template.expiry_date,
                image_url=template.image_url,
                coupon_type='store',  # EasyUse coupons are store type
                estimated_savings=template.estimated_savings,
            )
            # Set tags for the coupon
            coupon.tags.set(template.tags.all())
        
        template_data = {
            'id': template.id,
            'coupon_name': template.coupon_name,
            'message': 'Coupon template created successfully'
        }
        
        return Response(template_data, status=status.HTTP_201_CREATED)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@swagger_auto_schema(
    method='put',
    operation_description="Update a coupon template",
    request_body=CouponTemplateSerializer,
)
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_coupon_template(request, id):
    """
    Update a coupon template. Only accessible by the owner merchant.
    """
    store = get_merchant_store(request.user)
    if not store:
        return Response({
            'error': 'No store found for this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        template = CouponTemplate.objects.get(id=id, store=store)
    except CouponTemplate.DoesNotExist:
        return Response({
            'error': 'Coupon template not found or you do not have permission to access it.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    serializer = CouponTemplateSerializer(data=request.data, partial=True)
    if serializer.is_valid():
        validated_data = serializer.validated_data
        
        # Update fields
        if 'coupon_name' in validated_data:
            template.coupon_name = validated_data['coupon_name']
        if 'coupon_detail' in validated_data:
            template.coupon_detail = validated_data['coupon_detail']
        if 'important_notes' in validated_data:
            template.important_notes = validated_data['important_notes']
        if 'image_url' in validated_data:
            template.image_url = validated_data['image_url']
        if 'estimated_savings' in validated_data:
            template.estimated_savings = validated_data['estimated_savings']
        if 'template_redeem_code' in validated_data:
            template.template_redeem_code = validated_data['template_redeem_code']
        if 'start_date' in validated_data:
            template.start_date = validated_data['start_date']
        if 'expiry_date' in validated_data:
            template.expiry_date = validated_data['expiry_date']
        if 'draw_probability' in validated_data:
            template.draw_probability = validated_data['draw_probability']
        if 'is_active' in validated_data:
            template.is_active = validated_data['is_active']
        
        # Handle quantity update (adjust remaining_quantity accordingly)
        old_total_quantity = template.total_quantity
        if 'total_quantity' in validated_data:
            new_total = validated_data['total_quantity']
            # Calculate redeemed quantity (cannot be reduced)
            redeemed_quantity = template.total_quantity - template.remaining_quantity
            
            # Validate: new total quantity cannot be less than redeemed quantity
            if new_total < template.total_quantity:
                return Response({
                    'error': f'Total quantity cannot be reduced below the current total ({template.total_quantity}). Only increases are allowed.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            difference = new_total - template.total_quantity
            template.total_quantity = new_total
            template.remaining_quantity = max(0, template.remaining_quantity + difference)
        
        template.save()
        
        # Update tags if provided
        if 'tags' in validated_data:
            tag_ids = validated_data['tags']
            tags = Tag.objects.filter(id__in=tag_ids)
            template.tags.set(tags)
        
        # Handle Coupon object synchronization for "一般" type (total_quantity = 0)
        # Find existing store-type coupon linked to this template
        existing_coupon = Coupon.objects.filter(template=template, coupon_type='store').first()
        
        # Check if this is a "一般" type coupon (total_quantity = 0)
        # After save, template.total_quantity is the current value
        if template.total_quantity == 0:
            # This is a "一般" type coupon - should have a corresponding store-type Coupon
            if existing_coupon:
                # Update existing coupon with all template fields
                existing_coupon.coupon_name = template.coupon_name
                existing_coupon.coupon_detail = template.coupon_detail
                existing_coupon.important_notes = template.important_notes
                existing_coupon.image_url = template.image_url
                existing_coupon.estimated_savings = template.estimated_savings
                existing_coupon.start_date = template.start_date
                existing_coupon.expiry_date = template.expiry_date
                existing_coupon.save()
                # Update tags
                existing_coupon.tags.set(template.tags.all())
            else:
                # Create new coupon if it doesn't exist (e.g., changed from "共享" to "一般")
                coupon = Coupon.objects.create(
                    store=store,
                    template=template,
                    coupon_name=template.coupon_name,
                    coupon_detail=template.coupon_detail,
                    important_notes=template.important_notes,
                    start_date=template.start_date,
                    expiry_date=template.expiry_date,
                    image_url=template.image_url,
                    coupon_type='store',
                    estimated_savings=template.estimated_savings,
                )
                coupon.tags.set(template.tags.all())
        else:
            # This is a "共享" type coupon - should not have a store-type Coupon
            # Delete existing store-type coupon if it exists (e.g., changed from "一般" to "共享")
            if existing_coupon:
                existing_coupon.delete()
        
        template_data = {
            'id': template.id,
            'coupon_name': template.coupon_name,
            'message': 'Coupon template updated successfully'
        }
        
        return Response(template_data, status=status.HTTP_200_OK)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@swagger_auto_schema(
    method='delete',
    operation_description="Delete a coupon template",
)
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_coupon_template(request, id):
    """
    Delete a coupon template. Only accessible by the owner merchant.
    Also deletes the associated image file if it's stored locally.
    """
    store = get_merchant_store(request.user)
    if not store:
        return Response({
            'error': 'No store found for this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        template = CouponTemplate.objects.get(id=id, store=store)
        
        # Delete associated store-type Coupon if it exists (for "一般" type coupons)
        existing_coupon = Coupon.objects.filter(template=template, coupon_type='store').first()
        if existing_coupon:
            existing_coupon.delete()
        
        # Delete associated image file if it exists and is stored locally
        if template.image_url:
            image_url = template.image_url
            # Check if it's a local file
            # Local files can be:
            # 1. Starts with /media/ (relative path)
            # 2. Contains the MEDIA_URL path (full URL with domain)
            # 3. Just a filename (no http/https)
            is_local_file = False
            filename = None
            
            if image_url.startswith(settings.MEDIA_URL):
                # Relative path like /media/filename.jpg
                filename = image_url.replace(settings.MEDIA_URL, '')
                is_local_file = True
            elif settings.MEDIA_URL in image_url:
                # Full URL like http://localhost:8000/media/filename.jpg
                # Extract filename from URL
                parts = image_url.split(settings.MEDIA_URL)
                if len(parts) > 1:
                    filename = parts[-1].split('?')[0]  # Remove query parameters if any
                    is_local_file = True
            elif not (image_url.startswith('http://') or image_url.startswith('https://')):
                # Just a filename without path
                filename = image_url.split('/')[-1].split('?')[0]
                is_local_file = True
            
            if is_local_file and filename:
                try:
                    # Build full file path
                    file_path = settings.MEDIA_ROOT / filename
                    
                    # Delete the file if it exists
                    if file_path.exists() and file_path.is_file():
                        os.remove(file_path)
                        print(f'[Delete] Successfully deleted image file: {file_path}')
                    else:
                        print(f'[Delete] Image file not found: {file_path}')
                except Exception as e:
                    # Log error but don't fail the deletion
                    print(f'[Delete] Failed to delete image file {filename}: {e}')
        
        # Delete the template
        template.delete()
        return Response({
            'message': 'Coupon template deleted successfully'
        }, status=status.HTTP_200_OK)
    except CouponTemplate.DoesNotExist:
        return Response({
            'error': 'Coupon template not found or you do not have permission to delete it.'
        }, status=status.HTTP_404_NOT_FOUND)


@swagger_auto_schema(
    method='get',
    operation_description="Get all available tags for coupon categorization",
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_tags(request):
    """Get all available tags for coupon categorization"""
    tags = Tag.objects.all().order_by('display_name')
    return Response([
        {'id': tag.id, 'name': tag.name, 'display_name': tag.display_name}
        for tag in tags
    ], status=status.HTTP_200_OK)


@swagger_auto_schema(
    method='post',
    operation_description="Redeem a coupon using phone number and template ID",
    request_body=MerchantRedeemSerializer,
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def merchant_redeem(request):
    """
    Merchant redeem a coupon using phone number and template ID.
    This is used for the QR code redemption page.
    """
    serializer = MerchantRedeemSerializer(data=request.data)
    if serializer.is_valid():
        template_id = serializer.validated_data['template_id']
        phone_number = serializer.validated_data['phone_number']
        
        store = get_merchant_store(request.user)
        if not store:
            return Response({
                'error': 'No store found for this merchant.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            # Check if the phone_number can find the user
            user_profile = StudentProfile.objects.get(phone_number=phone_number)
            user = user_profile.user
            
            # Check if the template exists and belongs to the merchant's store
            template = CouponTemplate.objects.get(
                id=template_id,
                store=store,
                is_active=True,
                remaining_quantity__gt=0
            )
            
            # Find an existing coupon from this template for this user
            coupon = Coupon.objects.filter(
                template=template,
                current_holder=user,
                coupon_type='exclusive'
            ).first()
            
            if not coupon:
                return Response({
                    'error': 'No coupon found for this user from this template.'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Check if already redeemed
            from ..models import CouponRedemption
            if CouponRedemption.objects.filter(coupon=coupon, user=user).exists():
                return Response({
                    'error': 'This coupon has already been redeemed.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create redemption
            CouponRedemption.objects.create(
                coupon=coupon,
                user=user,
                savings_amount=template.estimated_savings
            )
            
            # Log the redemption
            Log.objects.create(
                user=user,
                coupon=coupon,
                action='redeem',
            )
            
            return Response({
                'message': 'Coupon redeemed successfully',
                'coupon_name': coupon.coupon_name,
                'redeemed_at': timezone.now().isoformat()
            }, status=status.HTTP_200_OK)
            
        except StudentProfile.DoesNotExist:
            return Response({
                'error': 'User with this phone number does not exist.'
            }, status=status.HTTP_404_NOT_FOUND)
        except CouponTemplate.DoesNotExist:
            return Response({
                'error': 'Coupon template does not exist, is not active, or is out of stock.'
            }, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@swagger_auto_schema(
    method='post',
    operation_description="Upload an image file for merchant use (coupon or store)",
    manual_parameters=[
        openapi.Parameter(
            'image',
            openapi.IN_FORM,
            description="Image file to upload",
            type=openapi.TYPE_FILE,
            required=True
        )
    ],
    responses={
        200: openapi.Response(
            description="Image uploaded successfully",
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'image_url': openapi.Schema(type=openapi.TYPE_STRING, description='URL of the uploaded image'),
                }
            )
        ),
        400: openapi.Response(description="Bad request - invalid file or missing file"),
        413: openapi.Response(description="File too large"),
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_image(request):
    """
    Upload an image file for merchant use.
    Accepts multipart/form-data with 'image' field.
    Returns the URL of the uploaded image.
    """
    # Check if file is present
    if 'image' not in request.FILES:
        return Response({
            'error': 'No image file provided. Please include an "image" field in the request.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    image_file = request.FILES['image']
    
    # Validate file type
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    file_name = image_file.name.lower()
    file_extension = Path(file_name).suffix
    
    if file_extension not in allowed_extensions:
        return Response({
            'error': f'Invalid file type. Allowed types: {", ".join(allowed_extensions)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate file size (5MB limit)
    max_size = 5 * 1024 * 1024  # 5MB in bytes
    if image_file.size > max_size:
        return Response({
            'error': 'File too large. Maximum size is 5MB.'
        }, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
    
    try:
        # Ensure images directory exists
        images_dir = settings.MEDIA_ROOT
        os.makedirs(images_dir, exist_ok=True)
        
        # Generate unique filename: {timestamp}_{random}_{original_filename}
        timestamp = int(datetime.now().timestamp())
        random_str = secrets.token_hex(4)  # 8 character random string
        original_filename = Path(file_name).stem
        unique_filename = f"{timestamp}_{random_str}_{original_filename}{file_extension}"
        
        # Save file
        file_path = images_dir / unique_filename
        with open(file_path, 'wb+') as destination:
            for chunk in image_file.chunks():
                destination.write(chunk)
        
        # Return the URL
        image_url = f"{settings.MEDIA_URL}{unique_filename}"
        
        return Response({
            'image_url': image_url
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Failed to upload image: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@swagger_auto_schema(
    method='get',
    operation_description="Get comprehensive analytics for a specific coupon template. For exclusive templates, includes count fields (retention_count, stranger_acquisition_count, redemption_count, circulation_count, circulation_redemption_count) alongside rate fields.",
    manual_parameters=[
        openapi.Parameter('days', openapi.IN_QUERY, description="Time range in days (3, 7, 30, or 90)", type=openapi.TYPE_INTEGER, default=30),
    ],
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_template_analytics(request, id):
    """
    Get comprehensive analytics for a specific coupon template.
    
    For EasyUse (store) templates:
    - 曝光次數 (exposure_count): Template view count
    - 轉換率 (conversion_rate): Redemptions / Exposures
    
    For Exclusive templates:
    - 曝光次數 (exposure_count): Template view count
    - 轉換率 (conversion_rate): Redemptions / Exposures
    - 留客率 (retention_rate): Consolidate redemptions / Consolidate issued
    - 陌生獲客率 (stranger_acquisition_rate): Non-consolidate redemptions / Total redemptions
    - 流動率 (circulation_rate): (Transfer + Public pool) / Total coupons
    - 流動核銷率 (circulation_redemption_rate): (Transfer + Public pool redeemed) / (Transfer + Public pool)
    - 核銷率 (redemption_rate): Total redemptions / Total quantity
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
    
    # Get template and verify ownership
    try:
        template = CouponTemplate.objects.get(id=id, store=store)
    except CouponTemplate.DoesNotExist:
        return Response({
            'error': 'Template not found or you do not have permission to access it.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Get time range parameter (default 30 days)
    days = int(request.query_params.get('days', 30))
    if days not in [3, 7, 30, 90]:
        days = 30
    
    now = timezone.now()
    time_threshold = now - timedelta(days=days)
    
    # Fixed distance radius in meters (500 meters = 0.5 km)
    DISTANCE_RADIUS = 500
    
    # Base querysets filtered by template
    template_coupons = Coupon.objects.filter(template=template)
    template_redemptions = CouponRedemption.objects.filter(coupon__template=template)
    template_logs = Log.objects.filter(template=template)
    
    # Check if this is a store type template (EasyUse - total_quantity == 0)
    is_store_template = template.total_quantity == 0
    
    # For store templates (EasyUse), return exposure and conversion statistics
    if is_store_template:
        # 曝光次數 (Exposure Count): Template view count
        template_view_logs = template_logs.filter(action='template_view')
        exposure_count = template_view_logs.count()
        
        # 轉換率 (Conversion Rate): Redemptions / Exposures
        # For store templates, count all redemptions (not filtered by time range for total)
        total_redemptions = CouponRedemption.objects.filter(
            coupon__template=template,
            coupon__coupon_type='store'
        ).count()
        conversion_rate = total_redemptions / exposure_count if exposure_count > 0 else 0
        
        # Calculate trends (daily data)
        exposure_trend_data = []
        conversion_trend_data = []
        current_date = time_threshold.date()
        end_date = now.date()
        
        while current_date <= end_date:
            day_start = timezone.make_aware(datetime.combine(current_date, datetime.min.time()))
            day_end = day_start + timedelta(days=1)
            
            # Daily exposures
            day_exposures = template_view_logs.filter(
                timestamp__gte=day_start,
                timestamp__lt=day_end
            )
            day_exposure_count = day_exposures.count()
            
            # Daily redemptions
            day_redemptions = CouponRedemption.objects.filter(
                coupon__template=template,
                coupon__coupon_type='store',
                redeemed_at__gte=day_start,
                redeemed_at__lt=day_end
            ).count()
            
            # Daily conversion rate
            day_conversion_rate = day_redemptions / day_exposure_count if day_exposure_count > 0 else 0
            
            exposure_trend_data.append({
                'date': current_date.isoformat(),
                'value': day_exposure_count
            })
            
            conversion_trend_data.append({
                'date': current_date.isoformat(),
                'value': day_conversion_rate,  # Rate value for percentage view
                'count': day_redemptions  # Count value for count view (redemptions count)
            })
            
            current_date += timedelta(days=1)
        
        # Calculate averages
        exposure_avg = sum([d['value'] for d in exposure_trend_data]) / len(exposure_trend_data) if exposure_trend_data else 0
        conversion_avg = sum([d['value'] for d in conversion_trend_data]) / len(conversion_trend_data) if conversion_trend_data else 0
        
        return Response({
            'exposure_count': exposure_count,
            'conversion_rate': conversion_rate,
            'trends': {
                'exposure_count': {
                    'current': exposure_count,
                    'average': exposure_avg,
                    'daily_data': exposure_trend_data
                },
                'conversion_rate': {
                    'current': conversion_rate,
                    'average': conversion_avg,
                    'daily_data': conversion_trend_data
                }
            }
        }, status=status.HTTP_200_OK)
    
    # Calculate metrics for exclusive templates
    exclusive_coupons = template_coupons.filter(coupon_type='exclusive')
    exclusive_redemptions = template_redemptions.filter(coupon__coupon_type='exclusive')
    exclusive_redemptions_count = exclusive_redemptions.count()
    
    # 1. 曝光次數 (Exposure Count): Template view count
    template_view_logs = template_logs.filter(action='template_view')
    exposure_count = template_view_logs.count()
    
    # 2. 轉換率 (Conversion Rate): Redemptions / Exposures
    conversion_rate = exclusive_redemptions_count / exposure_count if exposure_count > 0 else 0
    
    # 3. 留客率 (Retention Rate): 電話歸戶核銷數 / 電話歸戶發放數
    # Count coupons issued via consolidate (電話歸戶)
    consolidate_coupons = exclusive_coupons.filter(acquisition_method='consolidate')
    consolidate_issued_count = consolidate_coupons.count()
    consolidate_redemptions = exclusive_redemptions.filter(coupon__acquisition_method='consolidate')
    consolidate_redemption_count = consolidate_redemptions.count()
    retention_rate = consolidate_redemption_count / consolidate_issued_count if consolidate_issued_count > 0 else 0
    
    # 4. 陌生獲客率 (Stranger Acquisition Rate): (非電話歸戶核銷數) / 總核銷數
    non_consolidate_redemptions = exclusive_redemptions.exclude(coupon__acquisition_method='consolidate')
    non_consolidate_redemption_count = non_consolidate_redemptions.count()
    stranger_acquisition_rate = non_consolidate_redemption_count / exclusive_redemptions_count if exclusive_redemptions_count > 0 else 0
    
    # 5. 流動率 (Circulation Rate): (transfer + public_pool) / 總優惠數
    total_coupons = exclusive_coupons.count()
    transfer_coupons = exclusive_coupons.filter(acquisition_method__in=['transfer', 'public_pool'])
    transfer_count = transfer_coupons.count()
    circulation_rate = transfer_count / total_coupons if total_coupons > 0 else 0
    
    # 6. 流動核銷率 (Circulation Redemption Rate): (transfer + public_pool 且已核銷) / 轉手優惠數
    transfer_redemptions = exclusive_redemptions.filter(coupon__acquisition_method__in=['transfer', 'public_pool'])
    transfer_redemption_count = transfer_redemptions.count()
    circulation_redemption_rate = transfer_redemption_count / transfer_count if transfer_count > 0 else 0
    
    # 7. 核銷率 (Redemption Rate): 已核銷數量 / 總數量
    redemption_rate = exclusive_redemptions_count / template.total_quantity if template.total_quantity > 0 else 0
    
    # Calculate trend data for all metrics (daily data)
    current_date = time_threshold.date()
    end_date = now.date()
    
    # Initialize trend data structures
    exposure_trend_data = []
    conversion_trend_data = []
    retention_trend_data = []
    stranger_acquisition_trend_data = []
    circulation_trend_data = []
    circulation_redemption_trend_data = []
    redemption_trend_data = []
    
    while current_date <= end_date:
        day_start = timezone.make_aware(datetime.combine(current_date, datetime.min.time()))
        day_end = day_start + timedelta(days=1)
        
        # Daily exposures
        day_exposures = template_view_logs.filter(
            timestamp__gte=day_start,
            timestamp__lt=day_end
        )
        day_exposure_count = day_exposures.count()
        
        # Daily exclusive redemptions
        day_exclusive_redemptions = exclusive_redemptions.filter(
            redeemed_at__gte=day_start,
            redeemed_at__lt=day_end
        )
        day_exclusive_count = day_exclusive_redemptions.count()
        
        # Daily conversion rate
        day_conversion_rate = day_exclusive_count / day_exposure_count if day_exposure_count > 0 else 0
        
        # Daily retention rate (consolidate redemptions / consolidate issued)
        day_consolidate_redemptions = day_exclusive_redemptions.filter(coupon__acquisition_method='consolidate')
        day_consolidate_redemption_count = day_consolidate_redemptions.count()
        # For retention rate, we use total consolidate issued (not just in this day)
        day_retention_rate = day_consolidate_redemption_count / consolidate_issued_count if consolidate_issued_count > 0 else 0
        
        # Daily stranger acquisition rate
        day_non_consolidate_redemptions = day_exclusive_redemptions.exclude(coupon__acquisition_method='consolidate')
        day_non_consolidate_count = day_non_consolidate_redemptions.count()
        day_stranger_rate = day_non_consolidate_count / day_exclusive_count if day_exclusive_count > 0 else 0
        
        # Daily circulation rate (transfer + public_pool / total)
        # Use total coupons for denominator (not just in this day)
        # For daily count, we count transfer coupons issued up to this day (cumulative)
        day_circulation_rate = transfer_count / total_coupons if total_coupons > 0 else 0
        # Note: circulation_count is cumulative (total transfer coupons), not daily
        # For trend display, we use the total transfer_count for each day
        
        # Daily circulation redemption rate
        day_transfer_redemptions = day_exclusive_redemptions.filter(coupon__acquisition_method__in=['transfer', 'public_pool'])
        day_transfer_redemption_count = day_transfer_redemptions.count()
        day_circulation_redemption_rate = day_transfer_redemption_count / transfer_count if transfer_count > 0 else 0
        
        # Daily redemption rate (已核銷數量 / 總數量)
        day_redemption_rate = day_exclusive_count / template.total_quantity if template.total_quantity > 0 else 0
        
        exposure_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_exposure_count
        })
        
        conversion_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_conversion_rate,  # Rate value for percentage view
            'count': day_exclusive_count  # Count value for count view (redemptions count)
        })
        
        retention_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_retention_rate,  # Rate value for percentage view
            'count': day_consolidate_redemption_count  # Count value for count view
        })
        
        stranger_acquisition_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_stranger_rate,  # Rate value for percentage view
            'count': day_non_consolidate_count  # Count value for count view
        })
        
        circulation_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_circulation_rate,  # Rate value for percentage view
            'count': transfer_count  # Count value for count view (total transfer count, not daily)
        })
        
        circulation_redemption_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_circulation_redemption_rate,  # Rate value for percentage view
            'count': day_transfer_redemption_count  # Count value for count view
        })
        
        redemption_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_redemption_rate,  # Rate value for percentage view
            'count': day_exclusive_count  # Count value for count view
        })
        
        current_date += timedelta(days=1)
    
    # Calculate averages for all trends
    def calculate_average(trend_data):
        valid_values = [d['value'] for d in trend_data if d['value'] is not None]
        return sum(valid_values) / len(valid_values) if valid_values else 0
    
    exposure_avg = calculate_average(exposure_trend_data)
    conversion_avg = calculate_average(conversion_trend_data)
    retention_avg = calculate_average(retention_trend_data)
    stranger_avg = calculate_average(stranger_acquisition_trend_data)
    circulation_avg = calculate_average(circulation_trend_data)
    circulation_redemption_avg = calculate_average(circulation_redemption_trend_data)
    redemption_avg = calculate_average(redemption_trend_data)
    
    return Response({
        'exposure_count': exposure_count,
        'conversion_rate': conversion_rate,
        'retention_rate': retention_rate,
        'stranger_acquisition_rate': stranger_acquisition_rate,
        'circulation_rate': circulation_rate,
        'circulation_redemption_rate': circulation_redemption_rate,
        'redemption_rate': redemption_rate,
        # Count fields (exclusive templates only)
        'retention_count': consolidate_redemption_count,
        'stranger_acquisition_count': non_consolidate_redemption_count,
        'redemption_count': exclusive_redemptions_count,
        'circulation_count': transfer_count,
        'circulation_redemption_count': transfer_redemption_count,
        'trends': {
            'exposure_count': {
                'current': exposure_count,
                'average': exposure_avg,
                'daily_data': exposure_trend_data
            },
            'conversion_rate': {
                'current': conversion_rate,
                'average': conversion_avg,
                'daily_data': conversion_trend_data
            },
            'retention_rate': {
                'current': retention_rate,
                'average': retention_avg,
                'daily_data': retention_trend_data
            },
            'stranger_acquisition_rate': {
                'current': stranger_acquisition_rate,
                'average': stranger_avg,
                'daily_data': stranger_acquisition_trend_data
            },
            'circulation_rate': {
                'current': circulation_rate,
                'average': circulation_avg,
                'daily_data': circulation_trend_data
            },
            'circulation_redemption_rate': {
                'current': circulation_redemption_rate,
                'average': circulation_redemption_avg,
                'daily_data': circulation_redemption_trend_data
            },
            'redemption_rate': {
                'current': redemption_rate,
                'average': redemption_avg,
                'daily_data': redemption_trend_data
            }
        }
    }, status=status.HTTP_200_OK)


@swagger_auto_schema(
    method='post',
    operation_description="Generate unified redemption code for merchant's store",
    responses={
        200: UnifiedRedemptionCodeSerializer,
        400: "Bad request - merchant has no store",
        401: "Unauthorized - authentication required"
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_unified_redemption_code_view(request):
    """
    Generate a unified redemption code for the merchant's store.
    This code works for all coupons from the merchant's store.
    """
    # Get merchant's store
    store = get_merchant_store(request.user)
    if not store:
        # Log failed attempt
        Log.objects.create(
            user=request.user,
            action='generate_unified_redemption_code_failed',
        )
        return Response({
            'error': '此商家沒有關聯的商店'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Generate new unified redemption code
    new_code = generate_unified_redemption_code()
    
    # Ensure code is unique (retry if collision, though unlikely)
    max_retries = 10
    retry_count = 0
    while Store.objects.filter(unified_redeem_code=new_code).exclude(id=store.id).exists() and retry_count < max_retries:
        new_code = generate_unified_redemption_code()
        retry_count += 1
    
    # Update store's unified redemption code
    store.unified_redeem_code = new_code
    store.save()
    
    # Log the successful generation
    Log.objects.create(
        user=request.user,
        action='generate_unified_redemption_code',
    )
    
    # Return response
    serializer = UnifiedRedemptionCodeSerializer({
        'unified_redeem_code': new_code,
        'store_id': store.id,
        'store_name': store.name
    })
    
    return Response(serializer.data, status=status.HTTP_200_OK)