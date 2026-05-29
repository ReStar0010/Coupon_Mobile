import json
import secrets
import logging

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from api.exceptions import (
    CouponAlreadyRedeemed,
    CouponNotHolder,
    ShareAlreadyClaimed,
    ShareAlreadyPublic,
    ShareFailed,
    ShareNotPendingForWithdraw,
    ShareRequestAlreadyProcessed,
    ShareRequestNotFound,
    SelfClaimNotAllowed,
)
from api.models import Coupon, CouponShareRequest, QRCodeSession
from api.spinner_coop.models import WalletTransaction
from api.spinner_coop.wallet_service import WalletService
from api.utils import display_face_value

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def share_coupon(request, coupon_id):
    """
    Create a share request for an exclusive coupon and generate a share link.
    """
    coupon = get_object_or_404(Coupon, id=coupon_id, coupon_type='exclusive')

    if coupon.current_holder != request.user:
        raise CouponNotHolder(developer_message="You do not own this coupon.")

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
    share_link_web = f"{api_base_url}/collection/{token}/?open_ext=1"

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

    Shared-link flows (personal claim fallback) always render the mobile landing;
    WEB_CONSUMER_FLOW_ENABLED is scoped to the table/desk QR flow only.
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
    android_package = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
    return render(request, 'claim_landing.html', {
        'token': token,
        'page_url': page_url,
        'title': title,
        'description': description,
        'app_store_id': app_store_id,
        'app_store_url': app_store_url,
        'play_store_url': play_store_url,
        'android_package': android_package,
        'landing_kind': 'claim',
    })


def claim_fixed_landing(request, token):
    """
    Fixed table-sticker claim URL fallback page: /claim-fixed/<token>/
    Redirects to web consumer fixed-claim route when enabled.
    """
    if getattr(settings, 'WEB_CONSUMER_FLOW_ENABLED', False):
        from django.shortcuts import redirect as http_redirect
        frontend_url = getattr(settings, 'FRONTEND_URL', '').rstrip('/')
        return http_redirect(f"{frontend_url}/w/claim-fixed/{token}/", permanent=False)

    api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro').rstrip('/')
    page_url = f"{api_base_url}/claim-fixed/{token}/"
    title = "CouPro 優惠券"
    description = "掃描桌上 QR Code 進入優惠頁。請下載 CouPro App 取得完整體驗。"
    app_store_id = getattr(settings, 'COUPRO_APP_STORE_ID', '') or ''
    app_store_url = f"https://apps.apple.com/app/id{app_store_id}" if app_store_id else "#"
    play_store_id = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
    play_store_url = f"https://play.google.com/store/apps/details?id={play_store_id}"
    android_package = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
    return render(request, 'claim_landing.html', {
        'token': token,
        'page_url': page_url,
        'title': title,
        'description': description,
        'app_store_id': app_store_id,
        'app_store_url': app_store_url,
        'play_store_url': play_store_url,
        'android_package': android_package,
        'landing_kind': 'claim',
    })


def collection_landing(request, token):
    """
    Universal Link fallback page: https://api.coupro.pro/collection/<token>
    Renders HTML with Smart App Banner (iOS), Open Graph, and JS to try app then fallback to stores.

    Shared coupon links always render the mobile landing (Universal Link + store
    fallback); WEB_CONSUMER_FLOW_ENABLED is scoped to the table/desk QR flow only
    and must not redirect shared links into the web consumer flow.
    """
    share_request = get_object_or_404(CouponShareRequest, token=token)
    api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro').rstrip('/')
    page_url = f"{api_base_url}/collection/{token}/"
    coupon_name = share_request.coupon.coupon_name or "優惠券"
    title = f"CouPro － {coupon_name} 分享"
    description = f"有人透過 CouPro 與您分享「{coupon_name}」。開啟 App 即可領取。"

    app_store_id = getattr(settings, 'COUPRO_APP_STORE_ID', '') or ''
    app_store_url = f"https://apps.apple.com/app/id{app_store_id}" if app_store_id else "#"
    play_store_id = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
    play_store_url = f"https://play.google.com/store/apps/details?id={play_store_id}"
    android_package = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')

    return render(request, 'collection_landing.html', {
        'token': token,
        'page_url': page_url,
        'title': title,
        'description': description,
        'app_store_id': app_store_id,
        'app_store_url': app_store_url,
        'play_store_url': play_store_url,
        'android_package': android_package,
        'landing_kind': 'collection',
    })


def voucher_landing(request, token):
    """
    Universal Link fallback page: https://api.coupro.pro/voucher/<token>
    Renders HTML with Smart App Banner (iOS), Open Graph, and JS to try app then fallback to stores.
    Same pattern as collection_landing but for PlatformVoucherShareRequest.
    """
    from api.models import PlatformVoucherShareRequest
    share_request = get_object_or_404(PlatformVoucherShareRequest, token=token)
    api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro').rstrip('/')
    page_url = f"{api_base_url}/voucher/{token}/"
    face_value = share_request.voucher.face_value
    face_int = display_face_value(face_value)
    currency = share_request.voucher.currency_code or 'NT$'
    coupon_name = f"${face_int} {currency} 現金券"
    title = f"CouPro － {coupon_name} 分享"
    description = f"有人透過 CouPro 與您分享「{coupon_name}」。開啟 App 即可領取。"

    app_store_id = getattr(settings, 'COUPRO_APP_STORE_ID', '') or ''
    app_store_url = f"https://apps.apple.com/app/id{app_store_id}" if app_store_id else "#"
    play_store_id = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')
    play_store_url = f"https://play.google.com/store/apps/details?id={play_store_id}"
    android_package = getattr(settings, 'COUPRO_PLAY_STORE_ID', 'com.cokayne.MobileFrontend')

    return render(request, 'voucher_landing.html', {
        'token': token,
        'page_url': page_url,
        'title': title,
        'description': description,
        'app_store_id': app_store_id,
        'app_store_url': app_store_url,
        'play_store_url': play_store_url,
        'android_package': android_package,
        'landing_kind': 'voucher',
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
                        'paths': ['/collection/*', '/claim/*', '/voucher/*'],
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
        raise CouponNotHolder(developer_message="You do not own this coupon.")

    # Check if coupon is already redeemed
    if coupon.is_redeemed():
        raise CouponAlreadyRedeemed(developer_message="This coupon has already been redeemed.")

    # Check if there's already a pending public share for this coupon
    existing_public_share = CouponShareRequest.objects.filter(
        coupon=coupon,
        is_public=True,
        status='pending'
    ).exists()

    if existing_public_share:
        raise ShareAlreadyPublic(developer_message="This coupon is already shared to the public pool.")

    share_message = ''
    raw_msg = request.data.get('message')
    if isinstance(raw_msg, str):
        share_message = raw_msg.strip()[:80]

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
                status='pending',
                message=share_message,
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
    try:
        share_request = CouponShareRequest.objects.select_related(
            'coupon', 'from_user'
        ).get(token=token)
    except CouponShareRequest.DoesNotExist:
        raise ShareRequestNotFound(developer_message="Share request not found or expired.")
    data = {
        'coupon_id': share_request.coupon.id,
        'coupon_name': share_request.coupon.coupon_name,
        'from_user_email': share_request.from_user.email,
        'status': share_request.status,
        'message': share_request.message,
    }
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_share_request(request, token):
    """
    Accept a share request and transfer the coupon to the current user.
    For public shares, implements first-come-first-served with race condition protection.
    """
    try:
        share_request = CouponShareRequest.objects.get(token=token)
    except CouponShareRequest.DoesNotExist:
        raise ShareRequestNotFound(developer_message="Share request not found or expired.")

    # Block self-claim for public shares
    if share_request.is_public and share_request.from_user == request.user:
        raise SelfClaimNotAllowed(developer_message="You cannot claim your own shared coupon.")

    # Use transaction with select_for_update to prevent race conditions
    with transaction.atomic():
        # Re-fetch with lock to prevent race conditions
        try:
            share_request = CouponShareRequest.objects.select_for_update().get(token=token)
        except CouponShareRequest.DoesNotExist:
            raise ShareRequestNotFound(developer_message="Share request not found or expired.")

        if share_request.status != 'pending':
            raise ShareRequestAlreadyProcessed(
                developer_message="This request has already been processed."
            )

        coupon = share_request.coupon

        # Only allow if coupon is still valid and not redeemed
        if coupon.is_redeemed():
            raise CouponAlreadyRedeemed(
                developer_message="This coupon has already been redeemed."
            )

        # Verify coupon is still available to be claimed.
        # - Public share: current_holder is None while pending; non-None means someone claimed.
        # - Private share: current_holder stays as from_user while pending; anything else
        #   means a sibling private share already transferred the coupon away.
        if share_request.is_public:
            if coupon.current_holder is not None:
                raise ShareAlreadyClaimed(
                    developer_message="This coupon has already been claimed."
                )
        else:
            if coupon.current_holder_id != share_request.from_user_id:
                raise ShareAlreadyClaimed(
                    developer_message="This coupon has already been claimed by another recipient."
                )

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

        # Invalidate sibling pending private share requests for the same coupon
        # so other recipients see an "already claimed" state instead of a
        # dangling pending invitation.
        sibling_cancelled = CouponShareRequest.objects.filter(
            coupon=coupon,
            is_public=False,
            status='pending',
        ).exclude(pk=share_request.pk).update(
            status='cancelled',
            responded_at=timezone.now(),
        )

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
            "sibling_shares_cancelled": sibling_cancelled,
        }
    )

    # Phase 2: +1 CouGem to the SHARER (original from_user) when their coupon
    # is accepted. This replaces the FE-side local mutation in
    # CouponShareScreen, where the gem was previously granted on share *creation*
    # rather than on acceptance. Sharer == sharer; recipient receives the
    # coupon, sharer receives the gem. Wallet-credit failures are logged but
    # do NOT block the transfer.
    sharer = share_request.from_user
    if sharer and sharer != request.user:
        try:
            WalletService.ensure_wallet(sharer.id, initial_gems=0)
            WalletService.mutate(
                sharer.id,
                delta_gems=+1,
                kind=WalletTransaction.Kind.SHARE_REWARD,
                related_coupon_id=coupon.id,
                related_store_id=coupon.store_id,
                note=f"{request.user.username} accepted your shared coupon",
            )
        except Exception as wallet_exc:  # noqa: BLE001 — log + continue
            logger.warning(
                "share_accept.gem_credit_failed",
                extra={
                    "sharer_id": sharer.id,
                    "accepter_id": request.user.id,
                    "coupon_id": coupon.id,
                    "error": str(wallet_exc),
                },
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def withdraw_public_share(request, share_id):
    """
    Withdraw a coupon from the public pool. Only the user who shared it (from_user)
    can withdraw. Valid only for pending public shares. Restores coupon to the user.
    """
    share_request = get_object_or_404(
        CouponShareRequest,
        id=share_id,
        from_user=request.user,
        is_public=True,
    )
    if share_request.status != 'pending':
        raise ShareNotPendingForWithdraw(
            developer_message="Only pending public shares can be withdrawn."
        )

    with transaction.atomic():
        share_request.status = 'cancelled'
        share_request.responded_at = timezone.now()
        share_request.save()

        coupon = share_request.coupon
        coupon.current_holder = request.user
        coupon.save(update_fields=['current_holder'])

    logger.info(
        "Public share withdrawn",
        extra={
            "user_id": request.user.id,
            "share_id": share_id,
            "coupon_id": coupon.id,
        },
    )
    return Response({'message': 'Coupon withdrawn from public pool.'}, status=status.HTTP_200_OK)