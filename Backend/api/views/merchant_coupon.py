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
from ..models import Coupon, CouponShareRequest, Log, StudentProfile, CouponTemplate, Store, Tag
from ..serializers import ConsolidateCouponSerializer, RefreshRedeemCodeSerializer, CouponTemplateSerializer, MerchantRedeemSerializer


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