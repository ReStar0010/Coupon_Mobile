import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError, ErrorDetail
from django.utils import timezone
from django.db.models import F
from django.db import transaction
from django.conf import settings
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from ...models import Coupon, CouponTemplate, StudentProfile, CouponRedemption, Store
from ...serializers import (
    ConsolidateCouponSerializer,
    RefreshRedeemCodeSerializer,
    MerchantRedeemSerializer,
    UnifiedRedemptionCodeSerializer,
)
from ...utils import generate_unified_redemption_code
from ...exceptions import (
    NoStoreForMerchant,
    CouponTemplateNotFound,
    CouponTemplateNotOwned,
    CouponTemplateOutOfStock,
    CouponAlreadyRedeemed,
    EulaNotAccepted,
    ImageTypeInvalid,
    ImageTooLarge,
    ImageUploadFailed,
    PhoneNotRegistered,
    PhoneFormatInvalid,
)
from .helpers import get_merchant_store

logger = logging.getLogger(__name__)


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
    from ...utils import validate_phone_number, mask_phone_number

    serializer = ConsolidateCouponSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    template_id = serializer.validated_data['template_id']  # type: ignore
    phone_number_raw = serializer.validated_data['phone_number']  # type: ignore

    # T015: Verify merchant owns this template's store
    store = get_merchant_store(request.user)
    if not store:
        raise NoStoreForMerchant(developer_message="No store found for this merchant.")

    # Validate and normalize phone number
    try:
        phone_number = validate_phone_number(phone_number_raw)
    except ValueError as e:
        raise PhoneFormatInvalid(
            developer_message=str(e),
            context={"field": "phone_number"},
        )

    # T015: Check if the template exists AND belongs to merchant's store
    try:
        coupon_template = CouponTemplate.objects.get(
            id=template_id,
            store=store,  # T015: Ownership check
            is_active=True,
            remaining_quantity__gt=0
        )
    except CouponTemplate.DoesNotExist:
        raise CouponTemplateNotFound(
            developer_message="Coupon template not found or not available."
        )

    # T016 & T017: Try to find registered user, or create pending coupon
    try:
        # T016: Registered user - assign immediately
        user_profile = StudentProfile.objects.get(phone_number=phone_number)
        user = user_profile.user

        # Generate coupon and check if successful
        generated_coupon = coupon_template.generate_coupon(user)
        if not generated_coupon:
            raise CouponTemplateOutOfStock(developer_message="Failed to generate coupon. Template may be out of stock.")

        # Set acquisition method to 'consolidate' (電話歸戶)
        generated_coupon.acquisition_method = 'consolidate'
        generated_coupon.save()

        # Log the consolidation action
        logger.info(
            "Coupon consolidated",
            extra={
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "action": "consolidate_coupon",
                "coupon_id": generated_coupon.id,
                "coupon_name": generated_coupon.coupon_name,
                "coupon_detail": generated_coupon.coupon_detail,
                "coupon_type": generated_coupon.coupon_type,
                "store_name": generated_coupon.store.name,
                "acquisition_method": generated_coupon.acquisition_method,
            }
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
        with transaction.atomic():
            updated_rows = CouponTemplate.objects.filter(
                id=coupon_template.id,
                is_active=True,
                remaining_quantity__gt=0,
            ).update(remaining_quantity=F('remaining_quantity') - 1)

            if updated_rows == 0:
                raise CouponTemplateOutOfStock(
                    developer_message="Coupon template is out of stock."
                )

            coupon_template.refresh_from_db(fields=['remaining_quantity', 'is_active'])
            if coupon_template.remaining_quantity <= 0 and coupon_template.is_active:
                coupon_template.is_active = False
                coupon_template.save(update_fields=['is_active'])

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
@permission_classes([IsAuthenticated])
def refresh_redeem_code(request):
    """
    Refresh the redeem code of CouponTemplate

    DEPRECATED: This endpoint is deprecated in favor of the unified redemption flow.
    Individual coupon QR code generation has been removed from the UI (per FR-010).
    This endpoint may remain for backward compatibility but should not be used by new code.
    Merchants should use the unified redemption button on the coupon list page instead.
    """
    serializer = RefreshRedeemCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    template_id = serializer.validated_data['template_id']
    new_redeem_code = serializer.validated_data['new_redeem_code']

    try:
        coupon_template = CouponTemplate.objects.select_related('store').get(id=template_id)
        if coupon_template.store.owner != request.user:
            raise CouponTemplateNotOwned(
                developer_message="Authenticated user does not own the store for this template."
            )
        coupon_template.template_redeem_code = new_redeem_code
        coupon_template.save()

        return Response({
            'message': 'Redeem code refreshed successfully',
            'new_redeem_code': new_redeem_code
        }, status=status.HTTP_200_OK)

    except CouponTemplate.DoesNotExist:
        raise CouponTemplateNotFound(
            developer_message="Coupon template does not exist."
        )


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
    serializer.is_valid(raise_exception=True)
    template_id = serializer.validated_data['template_id']
    phone_number = serializer.validated_data['phone_number']

    store = get_merchant_store(request.user)
    if not store:
        raise NoStoreForMerchant(developer_message="No store found for this merchant.")

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
            raise CouponTemplateNotFound(
                developer_message="No coupon found for this user from this template."
            )

        # Check if already redeemed
        if CouponRedemption.objects.filter(coupon=coupon, user=user).exists():
            raise CouponAlreadyRedeemed(developer_message="This coupon has already been redeemed.")

        # Savings amount for achievement list (use template amount; fallback to 0)
        savings_amount = template.estimated_savings or 0

        # Create redemption
        CouponRedemption.objects.create(
            coupon=coupon,
            user=user,
            savings_amount=template.estimated_savings
        )

        # Update user statistics (成就列表: total_savings, monthly_savings, coupons_used_count)
        try:
            user_profile.update_monthly_savings()
            user_profile.coupons_used_count += 1
            user_profile.total_savings += savings_amount
            user_profile.monthly_savings += savings_amount
            user_profile.save()
        except AttributeError:
            pass

        # Log the redemption
        logger.info(
            "Coupon redeemed",
            extra={
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "action": "redeem_coupon",
                "coupon_id": coupon.id,
                "coupon_name": coupon.coupon_name,
                "coupon_detail": coupon.coupon_detail,
                "coupon_type": coupon.coupon_type,
                "store_name": coupon.store.name,
                "savings_amount": savings_amount,
                "redeemed_at": timezone.now().isoformat()
            }
        )

        return Response({
            'message': 'Coupon redeemed successfully',
            'coupon_name': coupon.coupon_name,
            'redeemed_at': timezone.now().isoformat()
        }, status=status.HTTP_200_OK)

    except StudentProfile.DoesNotExist:
        raise PhoneNotRegistered(developer_message="User with this phone number does not exist.")
    except CouponTemplate.DoesNotExist:
        raise CouponTemplateNotFound(
            developer_message="Coupon template does not exist, is not active, or is out of stock."
        )


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

    UGC Compliance: Requires EULA acceptance before first upload.
    """
    # Check EULA acceptance (UGC Compliance - User Story 3)
    from ...models import EULAAcceptance

    CURRENT_EULA_VERSION = getattr(settings, 'CURRENT_EULA_VERSION', '1.0.0')
    has_valid_eula = EULAAcceptance.objects.filter(
        merchant=request.user,
        version=CURRENT_EULA_VERSION
    ).exists()

    if not has_valid_eula:
        raise EulaNotAccepted(developer_message="請先接受使用條款才能上傳內容")

    # Check if file is present
    if 'image' not in request.FILES:
        raise DRFValidationError({"image": [ErrorDetail("No image file provided. Please include an \"image\" field in the request.", code="required")]})

    image_file = request.FILES['image']

    try:
        from ...utils import save_uploaded_image
        image_url = save_uploaded_image(image_file)

        return Response({
            'image_url': image_url
        }, status=status.HTTP_200_OK)
    except ValueError as e:
        message = str(e)
        if "Invalid file type" in message:
            raise ImageTypeInvalid(developer_message=message)
        if "File too large" in message:
            raise ImageTooLarge(developer_message=message, context={"max_mb": 5})
        raise DRFValidationError({"image": [ErrorDetail(message, code="invalid")]})
    except Exception as e:
        raise ImageUploadFailed(developer_message=f"Failed to upload image: {str(e)}")


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
        logger.error(
            "Failed to generate unified redemption code",
            extra={
                "user_id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "action": "unified_code_gen_fail",
            }
        )

        raise NoStoreForMerchant(developer_message="此商家沒有關聯的商店")

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
    logger.info(
        "Unified redemption code generated",
        extra={
            "user_id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "action": "unified_code_gen",
            "unified_redeem_code": new_code,
            "store_id": store.id,
            "store_name": store.name,
        }
    )

    # Return response
    serializer = UnifiedRedemptionCodeSerializer({
        'unified_redeem_code': new_code,
        'store_id': store.id,
        'store_name': store.name
    })

    return Response(serializer.data, status=status.HTTP_200_OK)
