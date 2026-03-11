"""
Platform cash voucher views: list, detail, redeem (consumer), share flows.
Feature: 011-platform-cash-voucher
"""
import secrets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.db import transaction

from ..models import PlatformVoucher, PlatformVoucherRedemption, PlatformVoucherShareRequest, Store
from ..serializers import PlatformVoucherRedeemRequestSerializer
from .merchant_profile import get_merchant_store


def _redeemable_platform_vouchers_queryset(user):
    """Vouchers held by user, not expired, not redeemed."""
    now = timezone.now()
    redeemed_ids = PlatformVoucherRedemption.objects.values_list("voucher_id", flat=True)
    return PlatformVoucher.objects.filter(
        current_holder=user,
        expiry_date__gt=now,
        start_date__lte=now,
    ).exclude(id__in=redeemed_ids)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def platform_voucher_list(request):
    """GET /api/platform-vouchers/ — list vouchers where current_holder=request.user, not expired, not redeemed."""
    qs = _redeemable_platform_vouchers_queryset(request.user)
    data = [
        {
            "id": pv.id,
            "face_value": str(pv.face_value),
            "currency_code": pv.currency_code,
            "redeem_code": pv.redeem_code,
            "expiry_date": pv.expiry_date.isoformat(),
            "batch_name": pv.batch_name or "",
        }
        for pv in qs
    ]
    return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def platform_voucher_detail(request, pk):
    """GET /api/platform-vouchers/<id>/ — detail; 403 if not holder, 404 if not found."""
    voucher = get_object_or_404(PlatformVoucher, pk=pk)
    if voucher.current_holder_id != request.user.id:
        return Response({"error": "Not the holder of this voucher."}, status=status.HTTP_403_FORBIDDEN)
    is_redeemed = PlatformVoucherRedemption.objects.filter(voucher=voucher).exists()
    data = {
        "id": voucher.id,
        "face_value": str(voucher.face_value),
        "currency_code": voucher.currency_code,
        "start_date": voucher.start_date.isoformat(),
        "expiry_date": voucher.expiry_date.isoformat(),
        "batch_name": voucher.batch_name or "",
        "redeem_code": voucher.redeem_code,
        "is_redeemed": is_redeemed,
        "current_holder_id": voucher.current_holder_id,
    }
    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def redeem_platform_voucher(request, voucher_id):
    """
    POST /api/platform-voucher/<voucher_id>/redeem/
    Body: { "redeem_code": "123456" } (store's 6-digit unified redemption code).
    Consumer must be current_holder; store must have accepts_platform_vouchers=True.
    """
    voucher = get_object_or_404(PlatformVoucher, pk=voucher_id)
    if voucher.current_holder_id != request.user.id:
        return Response({"error": "Not the current holder of this voucher."}, status=status.HTTP_403_FORBIDDEN)
    now = timezone.now()
    if voucher.expiry_date <= now or voucher.start_date > now:
        return Response({"error": "Voucher is expired or not yet valid."}, status=status.HTTP_404_NOT_FOUND)
    if PlatformVoucherRedemption.objects.filter(voucher=voucher).exists():
        return Response({"error": "Voucher has already been redeemed."}, status=status.HTTP_404_NOT_FOUND)

    ser = PlatformVoucherRedeemRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    code = ser.validated_data["redeem_code"]
    if not code or len(code) != 6 or not code.isdigit():
        return Response({"error": "Invalid redeem code format."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        store = Store.objects.get(unified_redeem_code=code)
    except Store.DoesNotExist:
        return Response({"error": "Invalid redeem code or store not found."}, status=status.HTTP_400_BAD_REQUEST)
    if not getattr(store, "accepts_platform_vouchers", False):
        return Response({"error": "Store does not accept platform vouchers."}, status=status.HTTP_400_BAD_REQUEST)

    PlatformVoucherRedemption.objects.create(
        voucher=voucher,
        user=request.user,
        store=store,
        amount_used=voucher.face_value,
    )
    return Response({"message": "Redeemed successfully."}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def share_platform_voucher(request, voucher_id):
    """POST /api/platform-voucher/<voucher_id>/share/ — create private share; return token and links."""
    voucher = get_object_or_404(PlatformVoucher, pk=voucher_id)
    if voucher.current_holder_id != request.user.id:
        return Response({"error": "Not the current holder."}, status=status.HTTP_403_FORBIDDEN)
    now = timezone.now()
    if voucher.expiry_date <= now or voucher.start_date > now:
        return Response({"error": "Voucher is expired or not yet valid."}, status=status.HTTP_400_BAD_REQUEST)
    if PlatformVoucherRedemption.objects.filter(voucher=voucher).exists():
        return Response({"error": "Voucher has already been redeemed."}, status=status.HTTP_400_BAD_REQUEST)

    token = secrets.token_urlsafe(32)
    PlatformVoucherShareRequest.objects.create(
        voucher=voucher,
        from_user=request.user,
        token=token,
        status='pending',
        is_public=False,
    )
    api_base = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro').rstrip('/')
    return Response({
        "token": token,
        "share_link": f"coupro://platform-voucher?token={token}",
        "share_link_web": f"{api_base}/api/platform-voucher/share/{token}/",
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_platform_voucher_share(request, token):
    """GET /api/platform-voucher/share/<token>/ — share info by token (AllowAny)."""
    share = get_object_or_404(PlatformVoucherShareRequest, token=token)
    return Response({
        "voucher_id": share.voucher_id,
        "face_value": str(share.voucher.face_value),
        "currency_code": share.voucher.currency_code,
        "from_user_email": share.from_user.email,
        "status": share.status,
        "is_public": share.is_public,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_platform_voucher_share(request, token):
    """POST /api/platform-voucher/share/<token>/accept/ — accept share; race-safe with select_for_update."""
    share = get_object_or_404(PlatformVoucherShareRequest, token=token)
    if share.is_public and share.from_user_id == request.user.id:
        return Response({"error": "You cannot claim your own public share."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        share = PlatformVoucherShareRequest.objects.select_for_update().get(token=token)
        if share.status != 'pending':
            return Response({"error": "This share has already been accepted or declined."}, status=status.HTTP_400_BAD_REQUEST)
        voucher = share.voucher
        if PlatformVoucherRedemption.objects.filter(voucher=voucher).exists():
            return Response({"error": "Voucher has already been redeemed."}, status=status.HTTP_400_BAD_REQUEST)
        if share.is_public and voucher.current_holder_id is not None:
            return Response({"error": "This voucher has already been claimed."}, status=status.HTTP_400_BAD_REQUEST)

        voucher.current_holder = request.user
        voucher.last_holder = share.from_user
        voucher.acquisition_method = 'public_pool' if share.is_public else 'transfer'
        voucher.save()

        share.to_user = request.user
        share.status = 'accepted'
        share.responded_at = timezone.now()
        share.save()

    return Response({"message": "Share accepted."}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def share_platform_voucher_public(request, voucher_id):
    """POST /api/platform-voucher/<voucher_id>/share-public/ — share to public pool; set current_holder to null."""
    voucher = get_object_or_404(PlatformVoucher, pk=voucher_id)
    if voucher.current_holder_id != request.user.id:
        return Response({"error": "Not the current holder."}, status=status.HTTP_403_FORBIDDEN)
    now = timezone.now()
    if voucher.expiry_date <= now or voucher.start_date > now:
        return Response({"error": "Voucher is expired or not yet valid."}, status=status.HTTP_400_BAD_REQUEST)
    if PlatformVoucherRedemption.objects.filter(voucher=voucher).exists():
        return Response({"error": "Voucher has already been redeemed."}, status=status.HTTP_400_BAD_REQUEST)
    if PlatformVoucherShareRequest.objects.filter(voucher=voucher, is_public=True, status='pending').exists():
        return Response({"error": "Voucher is already in the public pool."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        token = secrets.token_urlsafe(32)
        PlatformVoucherShareRequest.objects.create(
            voucher=voucher,
            from_user=request.user,
            token=token,
            status='pending',
            is_public=True,
        )
        voucher.current_holder = None
        voucher.last_holder = request.user
        voucher.save(update_fields=['current_holder', 'last_holder'])

    return Response({"message": "Shared to public pool.", "share_id": PlatformVoucherShareRequest.objects.get(token=token).id}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_public_voucher_shares(request):
    """GET /api/my-public-voucher-shares/ — list share requests where from_user=request.user and is_public=True."""
    shares = PlatformVoucherShareRequest.objects.filter(
        from_user=request.user,
        is_public=True,
    ).select_related('voucher', 'to_user').order_by('-created_at')
    data = []
    for s in shares:
        data.append({
            "share_id": s.id,
            "voucher_id": s.voucher_id,
            "face_value": str(s.voucher.face_value),
            "status": s.status,
            "created_at": s.created_at.isoformat(),
            "claimed_by": s.to_user.email if s.to_user else None,
            "claimed_at": s.responded_at.isoformat() if s.responded_at else None,
        })
    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def merchant_redeem_voucher(request):
    """
    POST /api/merchant/redeem-voucher/ — optional merchant redeem.
    Body: { "voucher_id": <id>, "consumer_phone": "0912345678" }.
    Resolve store via get_merchant_store(request.user); consumer by StudentProfile.phone_number must be current_holder.
    """
    from ..models import StudentProfile

    voucher_id = request.data.get('voucher_id')
    consumer_phone = request.data.get('consumer_phone')
    if not voucher_id or not consumer_phone:
        return Response({"error": "voucher_id and consumer_phone required."}, status=status.HTTP_400_BAD_REQUEST)

    store = get_merchant_store(request.user)
    if not store:
        return Response({"error": "No store found for this merchant."}, status=status.HTTP_404_NOT_FOUND)

    try:
        voucher = PlatformVoucher.objects.get(pk=voucher_id)
    except PlatformVoucher.DoesNotExist:
        return Response({"error": "Voucher not found."}, status=status.HTTP_404_NOT_FOUND)

    try:
        profile = StudentProfile.objects.get(phone_number=consumer_phone)
        consumer = profile.user
    except StudentProfile.DoesNotExist:
        return Response({"error": "Invalid phone or consumer not found."}, status=status.HTTP_400_BAD_REQUEST)

    if voucher.current_holder_id != consumer.id:
        return Response({"error": "Consumer is not the current holder of this voucher."}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    if voucher.expiry_date <= now or voucher.start_date > now:
        return Response({"error": "Voucher is expired or not yet valid."}, status=status.HTTP_400_BAD_REQUEST)
    if PlatformVoucherRedemption.objects.filter(voucher=voucher).exists():
        return Response({"error": "Voucher has already been redeemed."}, status=status.HTTP_400_BAD_REQUEST)
    if not getattr(store, "accepts_platform_vouchers", False):
        return Response({"error": "Store does not accept platform vouchers."}, status=status.HTTP_400_BAD_REQUEST)

    PlatformVoucherRedemption.objects.create(
        voucher=voucher,
        user=consumer,
        store=store,
        amount_used=voucher.face_value,
    )
    return Response({"message": "Redeemed successfully."}, status=status.HTTP_200_OK)
