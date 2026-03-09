import json

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404, render
from django.http import HttpResponse
from django.utils import timezone
from django.conf import settings
from django.db import transaction
import secrets
import logging

logger = logging.getLogger(__name__)

from ..models import Coupon, CouponShareRequest, Log, QRCodeSession


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def share_coupon(request, coupon_id):
    """
    Create a share request for an exclusive coupon and generate a share link.
    """
    coupon = get_object_or_404(Coupon, id=coupon_id, coupon_type='exclusive')

    if coupon.current_holder != request.user:
        return Response({'error': 'You do not own this coupon.'}, status=403)

    # Create a unique token
    token = secrets.token_urlsafe(32)
    share_request = CouponShareRequest.objects.create(
        coupon=coupon,
        from_user=request.user,
        token=token
    )

    # Log the share action
    logger.info(
        "Coupon shared",
        extra={
            "user_id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "action": "share",
            "coupon_id": coupon.id,
            "coupon_name": coupon.coupon_name,
            "coupon_detail": coupon.coupon_detail,
            "coupon_type": coupon.coupon_type,
            "store_name": coupon.store.name,
            "acquisition_method": coupon.acquisition_method,
        }
    )
    
    # Deep link: custom scheme (for in-app / native share) and Universal Link (clickable in messages)
    api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro').rstrip('/')
    share_link = f"coupro://collection?token={token}"
    share_link_web = f"{api_base_url}/collection/{token}"

    return Response({
        'share_link': share_link,
        'share_link_web': share_link_web,
        'token': token,
    })


def claim_landing(request, token):
    """
    Claim URL fallback page: https://api.coupro.pro/claim/<token>/ or /cl/<token>/
    Renders HTML with install guidance and store links only (no claim actions on web).
    Same pattern as collection_landing (002-qr-deep-linking).
    """
    api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro').rstrip('/')
    page_url = f"{api_base_url}/claim/{token}/"
    title = "CouPro 優惠券"
    description = "掃描 QR Code 領取優惠券。請下載 CouPro App 開啟連結領取。"
    # Optional: resolve session for display (e.g. coupon name); 404 if invalid
    try:
        qr_session = QRCodeSession.objects.select_related('template').get(
            session_token=token,
            is_active=True
        )
        coupon_name = qr_session.template.coupon_name if qr_session.template else "優惠券"
        title = f"CouPro － {coupon_name}"
        description = f"有人與您分享「{coupon_name}」優惠。請下載 CouPro App 開啟連結領取。"
    except QRCodeSession.DoesNotExist:
        pass  # Keep default title/description
    app_store_id = getattr(settings, 'COUPRO_APP_STORE_ID', '') or ''
    app_store_url = f"https://apps.apple.com/app/id{app_store_id}" if app_store_id else "#"
    play_store_id = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
    play_store_url = f"https://play.google.com/store/apps/details?id={play_store_id}"
    return render(request, 'claim_landing.html', {
        'token': token,
        'page_url': page_url,
        'title': title,
        'description': description,
        'app_store_id': app_store_id,
        'app_store_url': app_store_url,
        'play_store_url': play_store_url,
    })


def collection_landing(request, token):
    """
    Universal Link fallback page: https://api.coupro.pro/collection/<token>
    Renders HTML with Smart App Banner (iOS), Open Graph, and JS to try app then fallback to stores.
    """
    share_request = get_object_or_404(CouponShareRequest, token=token)
    api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro').rstrip('/')
    page_url = f"{api_base_url}/collection/{token}"
    coupon_name = share_request.coupon.coupon_name or "優惠券"
    title = f"CouPro － {coupon_name} 分享"
    description = f"有人透過 CouPro 與您分享「{coupon_name}」。開啟 App 即可領取。"

    app_store_id = getattr(settings, 'COUPRO_APP_STORE_ID', '') or ''
    app_store_url = f"https://apps.apple.com/app/id{app_store_id}" if app_store_id else "#"
    play_store_id = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
    play_store_url = f"https://play.google.com/store/apps/details?id={play_store_id}"

    return render(request, 'collection_landing.html', {
        'token': token,
        'page_url': page_url,
        'title': title,
        'description': description,
        'app_store_id': app_store_id,
        'app_store_url': app_store_url,
        'play_store_url': play_store_url,
    })


def apple_app_site_association(request):
    """
    iOS Universal Links: serve AASA at https://api.coupro.pro/.well-known/apple-app-site-association
    No file extension; Content-Type: application/json.
    """
    team_id = getattr(settings, 'COUPRO_IOS_TEAM_ID', '') or ''
    bundle_id = 'com.cokayne.MobileFrontend'
    if not team_id:
        payload = {'applinks': {'apps': [], 'details': []}}
    else:
        payload = {
            'applinks': {
                'apps': [],
                'details': [
                    {
                        'appID': f'{team_id}.{bundle_id}',
                        'paths': ['/collection/*', '/claim/*'],
                    }
                ],
            }
        }
    return HttpResponse(
        json.dumps(payload),
        content_type='application/json',
    )


def assetlinks_json(request):
    """
    Android App Links: serve at https://api.coupro.pro/.well-known/assetlinks.json
    """
    package_name = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
    sha256_raw = getattr(settings, 'COUPRO_ANDROID_SHA256', '') or ''
    sha256_list = [s.strip() for s in sha256_raw.split(',') if s.strip()]
    if not sha256_list:
        payload = []
    else:
        payload = [
            {
                'relation': ['delegate_permission/common.handle_all_urls'],
                'target': {
                    'namespace': 'android_app',
                    'package_name': package_name,
                    'sha256_cert_fingerprints': sha256_list,
                },
            }
        ]
    return HttpResponse(
        json.dumps(payload),
        content_type='application/json',
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def share_coupon_public(request, coupon_id):
    """
    Share an exclusive coupon to the public pool (EasyUse).
    The coupon is immediately removed from user's collection.
    """
    coupon = get_object_or_404(Coupon, id=coupon_id, coupon_type='exclusive')

    # Verify ownership
    if coupon.current_holder != request.user:
        return Response({'error': 'You do not own this coupon.'}, status=403)

    # Check if coupon is already redeemed
    if coupon.is_redeemed():
        return Response({'error': 'This coupon has already been redeemed.'}, status=400)

    # Check if there's already a pending public share for this coupon
    existing_public_share = CouponShareRequest.objects.filter(
        coupon=coupon,
        is_public=True,
        status='pending'
    ).exists()

    if existing_public_share:
        return Response({'error': 'This coupon is already shared to the public pool.'}, status=400)

    try:
        with transaction.atomic():
            # Create a unique token for tracking
            token = secrets.token_urlsafe(32)

            # Create public share request
            share_request = CouponShareRequest.objects.create(
                coupon=coupon,
                from_user=request.user,
                to_user=None,  # No specific recipient for public shares
                token=token,
                is_public=True,
                status='pending'
            )

            # Immediately remove coupon from user's collection
            coupon.last_holder = coupon.current_holder
            coupon.current_holder = None
            coupon.save()

            # Log the share action
            logger.info(
                "Coupon shared to public pool",
                extra={
                    "user_id": request.user.id,
                    "username": request.user.username,
                    "email": request.user.email,
                    "action": "share_public",
                    "coupon_id": coupon.id,
                    "coupon_name": coupon.coupon_name,
                    "coupon_detail": coupon.coupon_detail,
                    "coupon_type": coupon.coupon_type,
                    "store_name": coupon.store.name,
                    "acquisition_method": coupon.acquisition_method,
                }
            )

    except Exception as e:
        logger.error(
            "Failed to share coupon to public pool",
            extra={
                "user_id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "action": "share_public_fail",
                "coupon_id": coupon.id,
                "coupon_name": coupon.coupon_name,
                "coupon_detail": coupon.coupon_detail,
                "coupon_type": coupon.coupon_type,
                "store_name": coupon.store.name,
                "acquisition_method": coupon.acquisition_method,
                "error": str(e),
            }
        )
        return Response({'error': f'Failed to share coupon: {str(e)}'}, status=500)

    return Response({
        'message': 'Coupon successfully shared to public pool.',
        'share_id': share_request.id,
        'token': token
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_share_request(request, token):
    """
    Get info about a share request (for displaying accept/decline UI).
    """
    share_request = get_object_or_404(CouponShareRequest, token=token)
    data = {
        'coupon_id': share_request.coupon.id,
        'coupon_name': share_request.coupon.coupon_name,
        'from_user_email': share_request.from_user.email,
        'status': share_request.status,
    }
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_share_request(request, token):
    """
    Accept a share request and transfer the coupon to the current user.
    For public shares, implements first-come-first-served with race condition protection.
    """
    share_request = get_object_or_404(CouponShareRequest, token=token)

    # Block self-claim for public shares
    if share_request.is_public and share_request.from_user == request.user:
        return Response({'error': 'You cannot claim your own shared coupon.'}, status=400)

    # Use transaction with select_for_update to prevent race conditions
    with transaction.atomic():
        # Re-fetch with lock to prevent race conditions
        share_request = CouponShareRequest.objects.select_for_update().get(token=token)

        if share_request.status != 'pending':
            return Response({'error': 'This request has already been processed.'}, status=400)

        coupon = share_request.coupon

        # Only allow if coupon is still valid and not redeemed
        if coupon.is_redeemed():
            return Response({'error': 'This coupon has already been redeemed.'}, status=400)

        # For public shares, verify coupon still has no current_holder
        if share_request.is_public and coupon.current_holder is not None:
            return Response({'error': 'This coupon has already been claimed.'}, status=400)

        # Transfer coupon
        coupon.current_holder = request.user
        coupon.last_holder = share_request.from_user
        # Set acquisition method based on share type
        if share_request.is_public:
            coupon.acquisition_method = 'public_pool'  # 公共池領取
        else:
            coupon.acquisition_method = 'transfer'  # 私人轉讓
        coupon.save()

        share_request.to_user = request.user
        share_request.status = 'accepted'
        share_request.responded_at = timezone.now()
        share_request.save()

    logger.info(
        "Coupon accepted",
        extra={
            "user_id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "action": "share_accept",
            "coupon_id": coupon.id,
            "coupon_name": coupon.coupon_name,
            "coupon_detail": coupon.coupon_detail,
            "coupon_type": coupon.coupon_type,
            "store_name": coupon.store.name,
            "acquisition_method": coupon.acquisition_method,
        }
    )
    return Response({
        'message': 'Coupon transferred successfully.',
        'coupon_id': coupon.id,
        'coupon_name': coupon.coupon_name
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_public_shares(request):
    """
    Get all coupons the user has shared to the public pool.
    Shows status (pending/accepted) for tracking purposes.
    """
    public_shares = CouponShareRequest.objects.filter(
        from_user=request.user,
        is_public=True
    ).select_related('coupon', 'coupon__store', 'to_user').order_by('-created_at')

    data = []
    for share in public_shares:
        coupon = share.coupon
        data.append({
            'share_id': share.id,
            'coupon_id': coupon.id,
            'coupon_name': coupon.coupon_name,
            'store_name': coupon.store.name if coupon.store else None,
            'image_url': coupon.image_url,
            'status': share.status,
            'created_at': share.created_at,
            'claimed_by': share.to_user.email if share.to_user else None,
            'claimed_at': share.responded_at,
        })

    return Response(data)