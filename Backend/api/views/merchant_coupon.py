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
from ..serializers import ConsolidateCouponSerializer, RefreshRedeemCodeSerializer, CouponTemplateSerializer, MerchantRedeemSerializer
from django.db.models import Count, F
from datetime import timedelta, datetime
import math


@swagger_auto_schema(
    method='post',
    operation_description="Consolidate coupon with user's information",
    request_body=ConsolidateCouponSerializer,
)
@api_view(['POST'])
@permission_classes([AllowAny]) #FIXME - change to IsAuthenticated if needed
def merchant_consolidate_coupon(request):
    """
    Merchant consolidate coupon with user's information (Phone number...).
    """
    serializer = ConsolidateCouponSerializer(data=request.data)
    if serializer.is_valid():
        template_id = serializer.validated_data['template_id'] # type: ignore
        phone_number = serializer.validated_data['phone_number'] # type: ignore

        try:
            # Check if the phone_number can find the user
            user_profile = StudentProfile.objects.get(phone_number=phone_number)
            user = user_profile.user

            # Check if the template exists AND has quantity > 0
            coupon_template = CouponTemplate.objects.get(
                id=template_id, 
                is_active=True,  
                remaining_quantity__gt=0  
            )
            
            # Generate coupon and check if successful
            generated_coupon = coupon_template.generate_coupon(user)
            if not generated_coupon:
                return Response({
                    'error': 'Failed to generate coupon. Template may be out of stock.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Log the consolidation action
            Log.objects.create(
                user=user,
                action='consolidate_coupon',
            )

            return Response({
                'message': 'Coupon consolidated successfully',
                'coupon_name': generated_coupon.coupon_name,
                'remaining_quantity': coupon_template.remaining_quantity
            }, status=status.HTTP_201_CREATED)
            
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
        operation_description="Refresh the redeem code of a coupon template",
        request_body=RefreshRedeemCodeSerializer,
)
@api_view(['POST'])
@permission_classes([AllowAny]) #FIXME - @permission_classes([IsAuthenticated])
def refresh_redeem_code(request):
    """
    Refresh the redeem code of CouponTemplate
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
    operation_description="Get analytics for a specific coupon template",
    manual_parameters=[
        openapi.Parameter('days', openapi.IN_QUERY, description="Time range in days (7, 30, or 90)", type=openapi.TYPE_INTEGER, default=30),
    ],
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_template_analytics(request, id):
    """
    Get comprehensive analytics for a specific coupon template including:
    1. GMV (Gross Merchandise Value)
    2. Stranger Acquisition Ratio (陌生獲客比)
    3. Coupon Activation Rate (優惠券活化率)
    4. Local Conversion Rate (在地轉換率)
    5. Overall Conversion Rate (總體轉換率)
    6. Redemption Rate (核銷率)
    7. User Transfer Ranking (用戶轉贈總數排行榜)
    8. Trends for all metrics
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
    if days not in [7, 30, 90]:
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
    
    # For store templates, only return click statistics
    if is_store_template:
        # Calculate click statistics
        template_view_logs = template_logs.filter(action='template_view')
        total_click_count = template_view_logs.count()
        unique_users_count = template_view_logs.exclude(user__isnull=True).values('user').distinct().count()
        
        # Calculate click trends (daily data)
        click_trend_data = []
        unique_users_trend_data = []
        current_date = time_threshold.date()
        end_date = now.date()
        
        while current_date <= end_date:
            day_start = timezone.make_aware(datetime.combine(current_date, datetime.min.time()))
            day_end = day_start + timedelta(days=1)
            
            # Daily clicks
            day_clicks = template_view_logs.filter(
                timestamp__gte=day_start,
                timestamp__lt=day_end
            )
            day_click_count = day_clicks.count()
            day_unique_users = day_clicks.exclude(user__isnull=True).values('user').distinct().count()
            
            click_trend_data.append({
                'date': current_date.isoformat(),
                'value': day_click_count
            })
            
            unique_users_trend_data.append({
                'date': current_date.isoformat(),
                'value': day_unique_users
            })
            
            current_date += timedelta(days=1)
        
        # Calculate averages
        click_avg = sum([d['value'] for d in click_trend_data]) / len(click_trend_data) if click_trend_data else 0
        unique_users_avg = sum([d['value'] for d in unique_users_trend_data]) / len(unique_users_trend_data) if unique_users_trend_data else 0
        
        return Response({
            'click_count': total_click_count,
            'unique_users': unique_users_count,
            'click_trend': {
                'current': total_click_count,
                'average': click_avg,
                'daily_data': click_trend_data
            },
            'unique_users_trend': {
                'current': unique_users_count,
                'average': unique_users_avg,
                'daily_data': unique_users_trend_data
            }
        }, status=status.HTTP_200_OK)
    
    # Only calculate redemption-related metrics for exclusive templates
    exclusive_redemptions = template_redemptions.filter(coupon__coupon_type='exclusive')
    exclusive_redemptions_count = exclusive_redemptions.count()
    
    # 1. GMV = 總核銷數 × 平均客單價 (only exclusive redemptions)
    average_order_value = store.average_order_value or 0
    gmv = float(exclusive_redemptions_count * average_order_value) if average_order_value else 0
    
    # 2. 陌生獲客比 = (總核銷數 - 原始擁有者核銷數) / 總核銷數
    # Only for exclusive coupons
    exclusive_redemptions = template_redemptions.filter(coupon__coupon_type='exclusive')
    exclusive_redemptions_count = exclusive_redemptions.count()
    
    if exclusive_redemptions_count > 0:
        original_owner_redemptions = exclusive_redemptions.filter(
            user=F('coupon__original_owner')
        ).count()
        stranger_acquisition_ratio = (exclusive_redemptions_count - original_owner_redemptions) / exclusive_redemptions_count
    else:
        stranger_acquisition_ratio = 0
    
    # 3. 優惠券活化率 = 轉手次數 ≥ 1 的核銷券數 / 總核銷數
    # Only for exclusive coupons
    if exclusive_redemptions_count > 0:
        # Get all redeemed exclusive coupons (distinct)
        redeemed_exclusive_coupons = exclusive_redemptions.values_list('coupon', flat=True).distinct()
        
        # Count coupons with transfer count >= 1
        activated_coupons_count = 0
        total_redeemed_coupons_count = len(redeemed_exclusive_coupons)
        
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
    
    # 4. 在地轉換率 = 近時間核銷數 / 近地點點擊數 (only exclusive redemptions)
    store_lat = store.lat
    store_lng = store.lng
    
    if is_store_template:
        local_conversion_rate = None  # Store templates don't track redemptions
    else:
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
        
        # Get clicks within distance (template_view events)
        nearby_clicks = template_logs.filter(action='template_view')
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
    total_template_views = template_logs.filter(action='template_view').count()
    if is_store_template:
        overall_conversion_rate = 0  # Store templates don't track redemptions
    elif total_template_views > 0:
        overall_conversion_rate = exclusive_redemptions_count / total_template_views
    else:
        overall_conversion_rate = 0
    
    # 6. 核銷率 = 總核銷數 / 優惠券總數（使用 template.total_quantity，only exclusive redemptions）
    if is_store_template:
        redemption_rate = 0  # Store templates don't track redemptions
    elif template.total_quantity > 0:
        redemption_rate = exclusive_redemptions_count / template.total_quantity
    else:
        redemption_rate = 0
    
    # 7. 用戶轉贈總數排行榜
    # Only for exclusive coupons from this template
    exclusive_coupons = template_coupons.filter(coupon_type='exclusive')
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
        
        # Daily clicks (template_view events)
        day_clicks = template_logs.filter(
            action='template_view',
            timestamp__gte=day_start,
            timestamp__lt=day_end
        )
        day_clicks_count = day_clicks.count()
        
        # 1. GMV trend (only exclusive redemptions, 0 for store templates)
        if is_store_template:
            day_gmv = 0
        else:
            average_order_value = store.average_order_value or 0
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
            for coupon_id in redeemed_coupon_ids:
                transfer_count = CouponShareRequest.objects.filter(
                    coupon_id=coupon_id,
                    status='accepted'
                ).count()
                if transfer_count >= 1:
                    day_activated_count += 1
            day_total_redeemed_coupons = len(redeemed_coupon_ids)
            day_activation_rate = day_activated_count / day_total_redeemed_coupons if day_total_redeemed_coupons > 0 else 0
        else:
            day_activation_rate = 0
        activation_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_activation_rate
        })
        
        # 4. Local conversion rate trend (only exclusive redemptions)
        if is_store_template:
            day_local_conversion = None
        else:
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
        if is_store_template:
            day_overall_conversion = 0
        elif day_clicks_count > 0:
            day_overall_conversion = day_exclusive_count / day_clicks_count
        else:
            day_overall_conversion = 0
        overall_conversion_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_overall_conversion
        })
        
        # 6. Redemption rate trend (only exclusive redemptions)
        if is_store_template:
            day_redemption_rate = 0
        elif template.total_quantity > 0:
            day_redemption_rate = day_exclusive_count / template.total_quantity
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
        }
    }, status=status.HTTP_200_OK)