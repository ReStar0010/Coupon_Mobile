"""
QR Code Coupon Claim Views
Feature: 005-qr-coupon-claim
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import F
import uuid
import json

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.conf import settings
import logging

from ..models import CouponTemplate, QRCodeSession, Coupon, Store, QRCodeClaim
from ..spinner_coop.models import WalletTransaction
from ..spinner_coop.wallet_service import WalletService

_logger = logging.getLogger(__name__)
from ..serializers import (
    GenerateQRSessionSerializer,
    InvalidateSessionSerializer,
    ClaimCouponRequestSerializer,
    ClaimByTokenRequestSerializer,
    ClaimCouponResponseSerializer
)
from ..exceptions import (
    NoStoreForMerchant,
    CouponTemplateNotFound,
    CouponTemplateExpired,
    CouponTemplateOutOfStock,
    QRSessionNotFound,
    QRSessionUnauthorized,
    QRSessionExpired,
)
from ..utils import get_merchant_store


@swagger_auto_schema(
    method='post',
    operation_description="Generate QR code session for coupon template",
    request_body=GenerateQRSessionSerializer,
    responses={
        201: openapi.Response('QR code session created successfully', GenerateQRSessionSerializer),
        400: openapi.Response('Bad request'),
        403: openapi.Response('Unauthorized merchant'),
        404: openapi.Response('Template not found'),
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_qr_session(request):
    """
    Generate QR code session for coupon template.
    POST /api/merchant/qr-session/generate/
    
    Creates a new QR code session for a coupon template. Returns template_id and session_token
    to encode in QR code. QR code is only valid while merchant keeps display open.
    """
    serializer = GenerateQRSessionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    template_id = serializer.validated_data['template_id']  # type: ignore
    
    # T016: Verify merchant owns this template's store
    store = get_merchant_store(request.user)
    if not store:
        raise NoStoreForMerchant(developer_message="No store found for this merchant.")
    
    # T016: Check if the template exists AND belongs to merchant's store
    try:
        template = CouponTemplate.objects.get(
            id=template_id,
            store=store,  # Ownership check
            is_active=True
        )
    except CouponTemplate.DoesNotExist:
        raise CouponTemplateNotFound(developer_message="Coupon template not found or not owned by this merchant.")
    
    # T017: Error handling - allow generation even if out of stock (users will get error on claim)
    # Check remaining_quantity but don't block generation
    if template.remaining_quantity <= 0:
        # Still allow generation, but note in response
        pass
    
    # Generate UUID4 session token
    session_token = str(uuid.uuid4())
    
    # Create QR code session
    qr_session = QRCodeSession.objects.create(
        template=template,
        merchant=request.user,
        session_token=session_token,
        is_active=True
    )
    
    # Create QR code data as JSON string (legacy; prefer encoding claim_link_web in QR for deep link)
    qr_code_data = json.dumps({
        'template_id': template.id,
        'session_token': session_token
    })
    
    # Claim URLs for deep link (002-qr-deep-linking)
    api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro').rstrip('/')
    claim_link_web = f"{api_base_url}/claim/{session_token}/"
    claim_link = f"coupro://claim?token={session_token}"
    
    return Response({
        'session_id': qr_session.id,
        'template_id': template.id,
        'session_token': session_token,
        'qr_code_data': qr_code_data,
        'claim_link_web': claim_link_web,
        'claim_link': claim_link,
        'message': 'QR code session created successfully'
    }, status=status.HTTP_201_CREATED)


@swagger_auto_schema(
    method='post',
    operation_description="Invalidate QR code session",
    responses={
        200: openapi.Response('Session invalidated successfully'),
        400: openapi.Response('Bad request'),
        403: openapi.Response('Unauthorized merchant'),
        404: openapi.Response('Session not found'),
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invalidate_qr_session(request, session_id):
    """
    Invalidate QR code session.
    POST /api/merchant/qr-session/{session_id}/invalidate/
    
    Invalidates an active QR code session. Called when merchant closes QR code display.
    """
    try:
        qr_session = QRCodeSession.objects.get(id=session_id)
    except QRCodeSession.DoesNotExist:
        raise QRSessionNotFound(developer_message="QR code session not found.")
    
    # Verify merchant owns this session
    if qr_session.merchant != request.user:
        raise QRSessionUnauthorized(developer_message="You do not own this QR code session.")
    
    # Invalidate session
    qr_session.is_active = False
    qr_session.invalidated_at = timezone.now()
    qr_session.save()
    
    return Response({
        'message': 'QR code session invalidated successfully',
        'session_id': qr_session.id
    }, status=status.HTTP_200_OK)


def claim_coupon_for_user(*, user, claim_token: str, idempotency_key: str = '') -> tuple[dict, int]:
    """Shared service: claim a coupon from a session token on behalf of a user.

    Returns (payload_dict, http_status). Raises CouProAPIException subclasses
    on validation failure. Used by both /api/qr-claim/claim/ (claim-token branch)
    and /api/coupon/receive/ (mobile scan-to-receive flow). Keeps the claim
    pipeline in one place — no DRF Request mutation gymnastics.
    """
    try:
        qr_session = QRCodeSession.objects.select_related('template').get(
            session_token=claim_token,
            is_active=True,
        )
    except QRCodeSession.DoesNotExist:
        raise QRSessionExpired(developer_message="QR code session expired or invalid")

    template = qr_session.template
    template_id = template.id
    session_token = claim_token
    idempotency_key = (idempotency_key or '').strip()

    # Pre-transaction idempotency check.
    if idempotency_key:
        try:
            existing_claim = QRCodeClaim.objects.select_related('coupon', 'template').get(
                idempotency_key=idempotency_key
            )
            return ({
                'message': 'Coupon already claimed (idempotent retry)',
                'coupon_id': existing_claim.coupon.id,
                'coupon_name': existing_claim.coupon.coupon_name,
                'template_id': existing_claim.template.id,
                'remaining_quantity': existing_claim.template.remaining_quantity,
                'acquisition_method': 'qr_claim',
            }, status.HTTP_200_OK)
        except QRCodeClaim.DoesNotExist:
            pass

    if template.expiry_date and template.expiry_date <= timezone.now():
        raise CouponTemplateExpired(developer_message="Coupon template expired")
    if template.remaining_quantity <= 0:
        raise CouponTemplateOutOfStock(developer_message="Coupon template out of stock")

    with transaction.atomic():
        # Re-check inside the transaction (double-check pattern).
        if idempotency_key:
            try:
                existing_claim = QRCodeClaim.objects.select_related('coupon', 'template').get(
                    idempotency_key=idempotency_key
                )
                template.refresh_from_db()
                return ({
                    'message': 'Coupon already claimed (idempotent retry)',
                    'coupon_id': existing_claim.coupon.id,
                    'coupon_name': existing_claim.coupon.coupon_name,
                    'template_id': existing_claim.template.id,
                    'remaining_quantity': existing_claim.template.remaining_quantity,
                    'acquisition_method': 'qr_claim',
                }, status.HTTP_200_OK)
            except QRCodeClaim.DoesNotExist:
                pass

        updated = CouponTemplate.objects.filter(
            id=template_id,
            remaining_quantity__gt=0,
        ).update(remaining_quantity=F('remaining_quantity') - 1)
        if updated == 0:
            raise CouponTemplateOutOfStock(developer_message="Coupon template out of stock")

        template.refresh_from_db()

        coupon = Coupon.objects.create(
            store=template.store,
            template=template,
            coupon_name=template.coupon_name,
            coupon_detail=template.coupon_detail,
            important_notes=template.important_notes,
            start_date=template.start_date,
            expiry_date=template.expiry_date,
            image_url=template.image_url,
            coupon_type='exclusive',
            estimated_savings=template.estimated_savings,
            original_owner=user,
            last_holder=None,
            current_holder=user,
            redeem_code=template.template_redeem_code if template.template_redeem_code else None,
            acquisition_method='qr_claim',
        )
        coupon.tags.set(template.tags.all())

        if idempotency_key:
            QRCodeClaim.objects.create(
                idempotency_key=idempotency_key,
                user=user,
                template=template,
                coupon=coupon,
                session_token=session_token,
            )

    # +1 gem hook — gem credit is per-coupon-idempotent because the
    # related_coupon_id is unique to this coupon. Repeated retries that hit
    # the idempotency-cached branch above bypass this entirely.
    try:
        WalletService.ensure_wallet(user.id, initial_gems=0)
        WalletService.mutate(
            user.id,
            delta_gems=+1,
            kind=WalletTransaction.Kind.QR_CLAIM,
            related_coupon_id=coupon.id,
            related_store_id=template.store_id,
            note=f"Claimed via QR at {template.store.name}",
        )
    except Exception as wallet_exc:  # noqa: BLE001
        _logger.warning(
            "qr_claim.gem_credit_failed",
            extra={
                "user_id": user.id,
                "coupon_id": coupon.id,
                "error": str(wallet_exc),
            },
        )

    return ({
        'message': 'Coupon claimed successfully',
        'coupon_id': coupon.id,
        'coupon_name': coupon.coupon_name,
        'template_id': template.id,
        'remaining_quantity': template.remaining_quantity,
        'acquisition_method': 'qr_claim',
    }, status.HTTP_201_CREATED)


@swagger_auto_schema(
    method='post',
    operation_description="Claim coupon via QR code",
    request_body=ClaimCouponRequestSerializer,
    responses={
        200: openapi.Response('Coupon already claimed (idempotent retry)', ClaimCouponResponseSerializer),
        201: openapi.Response('Coupon claimed successfully', ClaimCouponResponseSerializer),
        400: openapi.Response('Bad request'),
        401: openapi.Response('Unauthorized'),
        404: openapi.Response('Template or session not found'),
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def claim_coupon_via_qr(request):
    """
    Claim coupon via QR code.
    POST /api/qr-claim/claim/
    
    Accepts either:
    - claim_token (deep link): backend resolves to QRCodeSession and uses session.template.
    - template_id + session_token (legacy in-app scan): same as before.
    """
    # Claim-by-token flow (002-qr-deep-linking): single token; backend resolves to template
    if 'claim_token' in request.data and request.data.get('claim_token'):
        token_serializer = ClaimByTokenRequestSerializer(data=request.data)
        token_serializer.is_valid(raise_exception=True)
        claim_token = token_serializer.validated_data['claim_token']  # type: ignore
        idempotency_key = token_serializer.validated_data.get('idempotency_key', '').strip()  # type: ignore
        try:
            qr_session = QRCodeSession.objects.select_related('template').get(
                session_token=claim_token,
                is_active=True
            )
        except QRCodeSession.DoesNotExist:
            raise QRSessionExpired(developer_message="QR code session expired or invalid")
        template = qr_session.template
        template_id = template.id
        session_token = claim_token
        # Do not trust client template_id; use qr_session.template only
    else:
        serializer = ClaimCouponRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template_id = serializer.validated_data['template_id']  # type: ignore
        session_token = serializer.validated_data['session_token']  # type: ignore
        idempotency_key = serializer.validated_data.get('idempotency_key', '').strip()  # type: ignore
        # Resolve session and template (existing flow)
        try:
            qr_session = QRCodeSession.objects.get(
                session_token=session_token,
                is_active=True
            )
        except QRCodeSession.DoesNotExist:
            raise QRSessionExpired(developer_message="QR code session expired or invalid")
        try:
            template = CouponTemplate.objects.get(
                id=template_id,
                is_active=True
            )
        except CouponTemplate.DoesNotExist:
            raise CouponTemplateNotFound(developer_message="Template not found")
        # Ensure session's template matches (security: do not allow template_id from client to override)
        if qr_session.template_id != template_id:
            raise QRSessionExpired(developer_message="QR code session expired or invalid")
    
    # Idempotency check: if idempotency_key is provided and already exists, return existing coupon
    if idempotency_key:
        try:
            existing_claim = QRCodeClaim.objects.select_related('coupon', 'template').get(
                idempotency_key=idempotency_key
            )
            return Response({
                'message': 'Coupon already claimed (idempotent retry)',
                'coupon_id': existing_claim.coupon.id,
                'coupon_name': existing_claim.coupon.coupon_name,
                'template_id': existing_claim.template.id,
                'remaining_quantity': existing_claim.template.remaining_quantity,
                'acquisition_method': 'qr_claim'
            }, status=status.HTTP_200_OK)
        except QRCodeClaim.DoesNotExist:
            pass
    
    # Validate template expiry_date
    if template.expiry_date and template.expiry_date <= timezone.now():
        raise CouponTemplateExpired(developer_message="Coupon template expired")
    
    # T024: Validate remaining_quantity > 0
    if template.remaining_quantity <= 0:
        raise CouponTemplateOutOfStock(developer_message="Coupon template out of stock")
    
    # T027: Race condition handling - use atomic transaction with F() expression
    with transaction.atomic():
        # If idempotency_key provided, check again within transaction (double-check pattern)
        if idempotency_key:
            try:
                existing_claim = QRCodeClaim.objects.select_related('coupon', 'template').get(
                    idempotency_key=idempotency_key
                )
                # Reload template to get current remaining_quantity
                template.refresh_from_db()
                return Response({
                    'message': 'Coupon already claimed (idempotent retry)',
                    'coupon_id': existing_claim.coupon.id,
                    'coupon_name': existing_claim.coupon.coupon_name,
                    'template_id': existing_claim.template.id,
                    'remaining_quantity': existing_claim.template.remaining_quantity,
                    'acquisition_method': 'qr_claim'
                }, status=status.HTTP_200_OK)
            except QRCodeClaim.DoesNotExist:
                pass
        
        # Atomically decrement remaining_quantity
        updated = CouponTemplate.objects.filter(
            id=template_id,
            remaining_quantity__gt=0
        ).update(remaining_quantity=F('remaining_quantity') - 1)
        
        if updated == 0:
            # Quantity became 0 or negative during update
            raise CouponTemplateOutOfStock(developer_message="Coupon template out of stock")
        
        # Reload template to get updated remaining_quantity
        template.refresh_from_db()
        
        # T029: Create coupon with acquisition_method='qr_claim'
        coupon = Coupon.objects.create(
            store=template.store,
            template=template,
            coupon_name=template.coupon_name,
            coupon_detail=template.coupon_detail,
            important_notes=template.important_notes,
            start_date=template.start_date,
            expiry_date=template.expiry_date,
            image_url=template.image_url,
            coupon_type='exclusive',  # T029: QR-claimed coupons must be exclusive
            estimated_savings=template.estimated_savings,
            original_owner=request.user,
            last_holder=None,
            current_holder=request.user,  # T029: Set current_holder to authenticated user
            redeem_code=template.template_redeem_code if template.template_redeem_code else None,
            acquisition_method='qr_claim'  # T029: Set acquisition method
        )
        
        # Copy tags from template to coupon
        coupon.tags.set(template.tags.all())
        
        # Create QRCodeClaim record for idempotency tracking
        if idempotency_key:
            QRCodeClaim.objects.create(
                idempotency_key=idempotency_key,
                user=request.user,
                template=template,
                coupon=coupon,
                session_token=session_token
            )

    # Phase 2: +1 CouGem for claiming a coupon via QR. Mirrors the on-redeem
    # and on-share-accept credits. Wallet failures are logged but do NOT
    # roll back the claim — the coupon belongs to the user regardless.
    try:
        WalletService.ensure_wallet(request.user.id, initial_gems=0)
        WalletService.mutate(
            request.user.id,
            delta_gems=+1,
            kind=WalletTransaction.Kind.QR_CLAIM,
            related_coupon_id=coupon.id,
            related_store_id=template.store_id,
            note=f"Claimed via QR at {template.store.name}",
        )
    except Exception as wallet_exc:  # noqa: BLE001 — log + continue
        _logger.warning(
            "qr_claim.gem_credit_failed",
            extra={
                "user_id": request.user.id,
                "coupon_id": coupon.id,
                "error": str(wallet_exc),
            },
        )

    return Response({
        'message': 'Coupon claimed successfully',
        'coupon_id': coupon.id,
        'coupon_name': coupon.coupon_name,
        'template_id': template.id,
        'remaining_quantity': template.remaining_quantity,
        'acquisition_method': 'qr_claim'
    }, status=status.HTTP_201_CREATED)
