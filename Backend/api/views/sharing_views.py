from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
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
    
    # Build the share link (adjust FRONTEND_URL as needed)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

    # Update the URL to point to Collection page instead of Login/share
    share_link = f"{frontend_url}/Collection?token={token}"
    return Response({'share_link': share_link, 'token': token})

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
    """
    share_request = get_object_or_404(CouponShareRequest, token=token)

    if share_request.status != 'pending':
        return Response({'error': 'This request has already been processed.'}, status=400)

    coupon = share_request.coupon

    # Only allow if coupon is still valid and not redeemed
    if coupon.is_redeemed():
        return Response({'error': 'This coupon has already been redeemed.'}, status=400)

    # Transfer coupon
    coupon.current_holder = request.user
    coupon.last_holder = share_request.from_user
    coupon.save()

    share_request.to_user = request.user
    share_request.status = 'accepted'
    share_request.responded_at = timezone.now()
    share_request.save()

    Log.objects.create(action="share_accept", user=request.user, coupon=coupon)
    return Response({'message': 'Coupon transferred successfully.'})