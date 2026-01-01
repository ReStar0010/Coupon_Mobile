from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
from django.db import transaction
import secrets

from ..models import Coupon, CouponShareRequest, Log


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
    Log.objects.create(action="share", user=request.user, coupon=coupon)
    
    # Build the deep link for mobile app
    # Uses the app's custom URL scheme defined in app.json (scheme: "CouPro")
    # This will open the app directly to the Collection page with the share token
    share_link = f"CouPro://Collection?token={token}"

    return Response({'share_link': share_link, 'token': token})


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
            Log.objects.create(action="share_public", user=request.user, coupon=coupon)

    except Exception as e:
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

    Log.objects.create(action="share_accept", user=request.user, coupon=coupon)
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