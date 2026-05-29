import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Count, Q
from drf_yasg.utils import swagger_auto_schema

from ...models import Coupon, CouponTemplate, Tag
from ...serializers import CouponTemplateSerializer
from ...exceptions import (
    NoStoreForMerchant,
    CouponTemplateNotFound,
    EulaNotAccepted,
    TemplateQuantityDecreaseNotAllowed,
    ImageDeleteFailed,
)
from .helpers import get_merchant_store

logger = logging.getLogger(__name__)


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
        raise NoStoreForMerchant(developer_message="No store found for this merchant. Please create a store first.")

    # prefetch_related('tags') avoids N tag queries.
    # annotate redemption_count in a single DB round-trip instead of one .count() per template.
    templates = (
        CouponTemplate.objects.filter(store=store)
        .order_by('-created_at')
        .prefetch_related('tags')
        .annotate(
            redemption_count=Count(
                'coupons',
                filter=Q(coupons__coupon_type='exclusive'),
                distinct=True,
            )
        )
    )

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
            'show_in_desk_qrcode': template.show_in_desk_qrcode,
            'created_at': template.created_at.isoformat(),
            'tags': [tag.id for tag in template.tags.all()],
            'redemption_count': template.redemption_count,
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
        raise NoStoreForMerchant(developer_message="No store found for this merchant.")

    try:
        template = CouponTemplate.objects.get(id=id, store=store)
    except CouponTemplate.DoesNotExist:
        raise CouponTemplateNotFound(developer_message="Coupon template not found or you do not have permission to access it.")

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
        'show_in_desk_qrcode': template.show_in_desk_qrcode,
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

    UGC Compliance: Requires EULA acceptance before creating content.
    """
    # Check EULA acceptance (UGC Compliance - User Story 3)
    from ...models import EULAAcceptance

    CURRENT_EULA_VERSION = getattr(settings, 'CURRENT_EULA_VERSION', '1.0.0')
    has_valid_eula = EULAAcceptance.objects.filter(
        merchant=request.user,
        version=CURRENT_EULA_VERSION
    ).exists()

    if not has_valid_eula:
        raise EulaNotAccepted(developer_message="請先接受使用條款才能建立優惠券")

    store = get_merchant_store(request.user)
    if not store:
        raise NoStoreForMerchant(developer_message="No store found for this merchant. Please create a store first.")

    serializer = CouponTemplateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
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
            show_in_desk_qrcode=validated_data.get('show_in_desk_qrcode', True),
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
        raise NoStoreForMerchant(developer_message="No store found for this merchant.")

    try:
        template = CouponTemplate.objects.get(id=id, store=store)
    except CouponTemplate.DoesNotExist:
        raise CouponTemplateNotFound(developer_message="Coupon template not found or you do not have permission to access it.")

    serializer = CouponTemplateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
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
    if 'show_in_desk_qrcode' in validated_data:
        template.show_in_desk_qrcode = validated_data['show_in_desk_qrcode']

    # Handle quantity update (adjust remaining_quantity accordingly)
    if 'total_quantity' in validated_data:
        new_total = validated_data['total_quantity']

        # Validate: new total quantity cannot be less than current total
        if new_total < template.total_quantity:
            raise TemplateQuantityDecreaseNotAllowed(
                developer_message="Total quantity cannot be reduced below the current total. Only increases are allowed.",
                context={"current": template.total_quantity},
            )

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
        raise NoStoreForMerchant(developer_message="No store found for this merchant.")

    try:
        template = CouponTemplate.objects.get(id=id, store=store)

        # Delete associated store-type Coupon if it exists (for "一般" type coupons)
        existing_coupon = Coupon.objects.filter(template=template, coupon_type='store').first()
        if existing_coupon:
            existing_coupon.delete()

        # Delete associated image file from default storage (local disk or R2) if it's our media
        if template.image_url:
            image_url = template.image_url
            # Extract storage key (filename): /media/xxx, full URL with MEDIA_URL, or bare filename
            storage_key = None
            if image_url.startswith(settings.MEDIA_URL):
                storage_key = image_url.replace(settings.MEDIA_URL, '').lstrip('/')
            elif settings.MEDIA_URL in image_url:
                parts = image_url.split(settings.MEDIA_URL)
                if len(parts) > 1:
                    storage_key = (parts[-1].split('?')[0]).lstrip('/')
            elif not (image_url.startswith('http://') or image_url.startswith('https://')):
                storage_key = image_url.split('/')[-1].split('?')[0]
            else:
                # Full external URL (e.g. R2): key is the last path segment
                storage_key = image_url.rstrip('/').split('/')[-1].split('?')[0]
            if storage_key:
                try:
                    if default_storage.exists(storage_key):
                        default_storage.delete(storage_key)
                        logger.info("Successfully deleted image file: %s", storage_key)
                    else:
                        logger.debug("Image file not found during cleanup: %s", storage_key)
                except Exception as e:
                    logger.error("Failed to delete image file %s: %s", storage_key, e)
                    raise ImageDeleteFailed(
                        developer_message=f"Failed to delete image file from storage: {e}",
                        context={"storage_key": storage_key},
                    )

        # Delete the template (WebRedemption rows use SET_NULL + legacy_* snapshot fields)
        template.delete()
        return Response({
            'message': 'Coupon template deleted successfully'
        }, status=status.HTTP_200_OK)
    except CouponTemplate.DoesNotExist:
        raise CouponTemplateNotFound(developer_message="Coupon template not found or you do not have permission to delete it.")


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
