"""
Phone OTP verification views.
Handles OTP send and verify endpoints for phone number verification.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction

from api.models import PhoneOTPRecord, StudentProfile, Coupon
from api.serializers import SendOTPSerializer, VerifyOTPSerializer
from api.services.sms_service import SMSService
from api.utils import mask_phone_number


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_otp(request):
    """
    Send OTP to phone number for verification.

    Rate limits:
    - Max 3 requests per phone number per hour
    - 60-second cooldown between requests

    Returns 200 on success, 400 for validation errors, 429 for rate limits.
    """
    serializer = SendOTPSerializer(data=request.data)
    if not serializer.is_valid():
        errors = serializer.errors
        # Get the first validation error message
        error_message = next(iter(errors.values()))[0]
        return Response(
            {'error': str(error_message)},
            status=status.HTTP_400_BAD_REQUEST
        )

    phone_number = serializer.validated_data['phone_number']

    # Check if phone is registered to another user
    existing_profile = StudentProfile.objects.filter(
        phone_number=phone_number
    ).exclude(user=request.user).first()

    if existing_profile:
        return Response(
            {'error': '此電話號碼已被其他帳號使用'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check rate limits
    can_send, error_message, retry_after = PhoneOTPRecord.can_send_otp(phone_number)
    if not can_send:
        return Response(
            {'error': error_message, 'retry_after_seconds': retry_after},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    # Create OTP record
    otp_record = PhoneOTPRecord.create_otp(request.user, phone_number)

    # Send SMS
    sms_service = SMSService()
    result = sms_service.send_otp(phone_number, otp_record.otp_code)

    if not result['success']:
        # Delete the OTP record if SMS failed
        otp_record.delete()
        return Response(
            {'error': result.get('error', 'SMS發送失敗，請稍後再試')},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    masked_phone = mask_phone_number(phone_number)
    response_data = {
        'message': f'驗證碼已發送至 {masked_phone}',
        'cooldown_seconds': 60,
        'expires_in_seconds': 600
    }

    # Include dev mode info for testing
    if result.get('dev_mode'):
        response_data['dev_mode'] = True
        response_data['otp_code'] = result.get('otp_code')

    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_otp(request):
    """
    Verify OTP and update user's phone number.

    On success:
    1. User's phone number is updated
    2. Pending coupons for that phone are claimed
    3. If changing phone, unclaimed coupons from old phone transfer to user

    Returns 200 on success, 400 for invalid OTP.
    """
    serializer = VerifyOTPSerializer(data=request.data)
    if not serializer.is_valid():
        errors = serializer.errors
        error_message = next(iter(errors.values()))[0]
        return Response(
            {'error': str(error_message)},
            status=status.HTTP_400_BAD_REQUEST
        )

    phone_number = serializer.validated_data['phone_number']
    otp_code = serializer.validated_data['otp_code']

    # Find the most recent pending OTP for this phone/user
    otp_record = PhoneOTPRecord.objects.filter(
        user=request.user,
        phone_number=phone_number,
        is_verified=False
    ).order_by('-created_at').first()

    if not otp_record:
        return Response(
            {'error': '找不到待驗證的OTP，請重新發送驗證碼'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check expiration
    if otp_record.is_expired():
        return Response(
            {'error': '驗證碼已過期，請重新獲取'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check max attempts
    if not otp_record.can_attempt():
        return Response(
            {'error': '驗證碼輸入錯誤次數過多，請重新獲取驗證碼'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify OTP code
    if otp_record.otp_code != otp_code:
        otp_record.increment_attempt()
        attempts_remaining = 5 - otp_record.attempt_count
        return Response(
            {
                'error': '驗證碼錯誤，請重新輸入',
                'attempts_remaining': attempts_remaining
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # OTP is valid - perform phone update and coupon transfers
    with transaction.atomic():
        profile = request.user.student_profile
        old_phone = profile.phone_number

        # Transfer unclaimed coupons from old phone (if exists)
        old_phone_transferred = 0
        if old_phone and old_phone != phone_number:
            old_phone_transferred = Coupon.objects.filter(
                pending_phone_number=old_phone,
                current_holder__isnull=True
            ).update(
                current_holder=request.user,
                pending_phone_number=None,
                acquisition_method='consolidate'
            )

        # Update phone number
        profile.phone_number = phone_number
        profile.save()

        # Claim coupons pending on new phone
        new_phone_claimed = Coupon.objects.filter(
            pending_phone_number=phone_number,
            current_holder__isnull=True
        ).update(
            current_holder=request.user,
            pending_phone_number=None,
            acquisition_method='consolidate'
        )

        # Mark OTP as verified
        otp_record.is_verified = True
        otp_record.save()

        # Clean up old OTP records
        PhoneOTPRecord.cleanup_old_records(phone_number, request.user)

    masked_phone = mask_phone_number(phone_number)
    response_data = {
        'message': '電話號碼驗證成功',
        'phone_number': phone_number,
        'masked_phone': masked_phone,
        'pending_coupons_claimed': new_phone_claimed
    }

    if old_phone_transferred > 0:
        response_data['old_phone_coupons_transferred'] = old_phone_transferred

    return Response(response_data, status=status.HTTP_200_OK)
