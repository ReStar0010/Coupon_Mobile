from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
import secrets

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
        if 'total_quantity' in validated_data:
            new_total = validated_data['total_quantity']
            difference = new_total - template.total_quantity
            template.total_quantity = new_total
            template.remaining_quantity = max(0, template.remaining_quantity + difference)
        
        template.save()
        
        # Update tags if provided
        if 'tags' in validated_data:
            tag_ids = validated_data['tags']
            tags = Tag.objects.filter(id__in=tag_ids)
            template.tags.set(tags)
        
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
    """
    store = get_merchant_store(request.user)
    if not store:
        return Response({
            'error': 'No store found for this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        template = CouponTemplate.objects.get(id=id, store=store)
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