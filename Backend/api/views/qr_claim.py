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
from ..models import CouponTemplate, QRCodeSession, Coupon, Store, QRCodeClaim
from ..serializers import (
    GenerateQRSessionSerializer,
    InvalidateSessionSerializer,
    ClaimCouponRequestSerializer,
    ClaimCouponResponseSerializer
)


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
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    template_id = serializer.validated_data['template_id']  # type: ignore
    
    # T016: Verify merchant owns this template's store
    store = get_merchant_store(request.user)
    if not store:
        return Response({
            'error': 'No store found for this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # T016: Check if the template exists AND belongs to merchant's store
    try:
        template = CouponTemplate.objects.get(
            id=template_id,
            store=store,  # Ownership check
            is_active=True
        )
    except CouponTemplate.DoesNotExist:
        return Response({
            'error': 'Coupon template not found or not owned by this merchant.'
        }, status=status.HTTP_404_NOT_FOUND)
    
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
    
    # Create QR code data as JSON string
    qr_code_data = json.dumps({
        'template_id': template.id,
        'session_token': session_token
    })
    
    return Response({
        'session_id': qr_session.id,
        'template_id': template.id,
        'session_token': session_token,
        'qr_code_data': qr_code_data,
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
        return Response({
            'error': 'QR code session not found.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Verify merchant owns this session
    if qr_session.merchant != request.user:
        return Response({
            'error': 'Unauthorized: You do not own this QR code session.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Invalidate session
    qr_session.is_active = False
    qr_session.invalidated_at = timezone.now()
    qr_session.save()
    
    return Response({
        'message': 'QR code session invalidated successfully',
        'session_id': qr_session.id
    }, status=status.HTTP_200_OK)


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
    
    Claims a coupon by scanning a QR code. Validates session token and template availability,
    then creates coupon instance with acquisition_method='qr_claim'.
    """
    serializer = ClaimCouponRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    template_id = serializer.validated_data['template_id']  # type: ignore
    session_token = serializer.validated_data['session_token']  # type: ignore
    idempotency_key = serializer.validated_data.get('idempotency_key', '').strip()  # type: ignore
    
    # Idempotency check: if idempotency_key is provided and already exists, return existing coupon
    if idempotency_key:
        try:
            existing_claim = QRCodeClaim.objects.select_related('coupon', 'template').get(
                idempotency_key=idempotency_key
            )
            # Return existing coupon info with 200 status (idempotent retry)
            return Response({
                'message': 'Coupon already claimed (idempotent retry)',
                'coupon_id': existing_claim.coupon.id,
                'coupon_name': existing_claim.coupon.coupon_name,
                'template_id': existing_claim.template.id,
                'remaining_quantity': existing_claim.template.remaining_quantity,
                'acquisition_method': 'qr_claim'
            }, status=status.HTTP_200_OK)
        except QRCodeClaim.DoesNotExist:
            # Idempotency key doesn't exist, proceed with normal flow
            pass
    
    # T024: Validate session_token exists and is_active=True
    try:
        qr_session = QRCodeSession.objects.get(
            session_token=session_token,
            is_active=True
        )
    except QRCodeSession.DoesNotExist:
        return Response({
            'error': 'QR code session expired or invalid'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # T024: Validate template exists and is_active=True
    try:
        template = CouponTemplate.objects.get(
            id=template_id,
            is_active=True
        )
    except CouponTemplate.DoesNotExist:
        return Response({
            'error': 'Template not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # T028: Validate template expiry_date
    if template.expiry_date and template.expiry_date <= timezone.now():
        return Response({
            'error': 'Coupon template expired'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # T024: Validate remaining_quantity > 0
    if template.remaining_quantity <= 0:
        return Response({
            'error': 'Coupon template out of stock'
        }, status=status.HTTP_400_BAD_REQUEST)
    
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
            return Response({
                'error': 'Coupon template out of stock'
            }, status=status.HTTP_400_BAD_REQUEST)
        
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
    
    return Response({
        'message': 'Coupon claimed successfully',
        'coupon_id': coupon.id,
        'coupon_name': coupon.coupon_name,
        'template_id': template.id,
        'remaining_quantity': template.remaining_quantity,
        'acquisition_method': 'qr_claim'
    }, status=status.HTTP_201_CREATED)
