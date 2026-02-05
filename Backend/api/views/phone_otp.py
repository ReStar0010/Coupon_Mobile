"""
Phone OTP verification views.
Handles OTP send and verify endpoints for phone number verification.
Includes unauthenticated endpoints for registration and password reset.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import PhoneOTPRecord, StudentProfile, Coupon
from api.serializers import (
    SendOTPSerializer, VerifyOTPSerializer,
    RegistrationOTPSendSerializer, RegistrationOTPVerifySerializer,
    PhoneForgotPasswordSerializer, PhoneResetPasswordSerializer
)
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


# ===== REGISTRATION OTP ENDPOINTS (Unauthenticated) =====

@api_view(['POST'])
@permission_classes([AllowAny])
def send_registration_otp(request):
    """
    Send OTP to phone number for registration (unauthenticated).
    
    Validates:
    - Phone number format (Taiwan 09XXXXXXXX)
    - Phone is not already registered
    - Rate limits (3 per hour, 60 second cooldown)
    
    Returns 200 on success, 400 for validation errors, 409 if phone exists, 429 for rate limits.
    """
    serializer = RegistrationOTPSendSerializer(data=request.data)
    if not serializer.is_valid():
        errors = serializer.errors
        error_message = next(iter(errors.values()))[0]
        return Response(
            {'error': str(error_message)},
            status=status.HTTP_400_BAD_REQUEST
        )

    phone_number = serializer.validated_data['phone_number']

    # Check if phone is already registered
    existing_profile = StudentProfile.objects.filter(phone_number=phone_number).first()
    if existing_profile:
        return Response(
            {'error': '此電話號碼已註冊，請直接登入或使用其他號碼'},
            status=status.HTTP_409_CONFLICT
        )

    # Check rate limits for registration purpose
    can_send, error_message, retry_after = PhoneOTPRecord.can_send_otp(
        phone_number, 
        purpose='registration'
    )
    if not can_send:
        return Response(
            {'error': error_message, 'retry_after_seconds': retry_after},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    # Create OTP record with purpose='registration', user=None
    otp_record = PhoneOTPRecord.create_otp(
        user=None,
        phone_number=phone_number,
        purpose='registration'
    )

    # Send SMS
    sms_service = SMSService()
    result = sms_service.send_otp(phone_number, otp_record.otp_code)

    if not result['success']:
        otp_record.delete()
        return Response(
            {'error': result.get('error', 'SMS發送失敗，請稍後再試')},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    masked_phone = mask_phone_number(phone_number)
    response_data = {
        'message': f'註冊驗證碼已發送至 {masked_phone}',
        'cooldown_seconds': 60,
        'expires_in_seconds': 600
    }

    # Include dev mode info for testing
    if result.get('dev_mode'):
        response_data['dev_mode'] = True
        response_data['otp_code'] = result.get('otp_code')

    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_registration_otp(request):
    """
    Verify OTP and create user account with phone + password (unauthenticated).
    
    On success:
    1. Create User with username=phone_number
    2. Create StudentProfile with phone_verified=True, verified=False
    3. Claim any pending coupons for this phone
    4. Return JWT tokens (auto-login)
    
    Returns 201 on success, 400 for invalid OTP, 404 if no OTP found, 410 if expired.
    """
    serializer = RegistrationOTPVerifySerializer(data=request.data)
    if not serializer.is_valid():
        errors = serializer.errors
        error_message = next(iter(errors.values()))[0]
        return Response(
            {'error': str(error_message)},
            status=status.HTTP_400_BAD_REQUEST
        )

    phone_number = serializer.validated_data['phone_number']
    otp_code = serializer.validated_data['otp_code']
    password = serializer.validated_data['password']

    # Find the most recent pending registration OTP for this phone
    otp_record = PhoneOTPRecord.objects.filter(
        phone_number=phone_number,
        purpose='registration',
        is_verified=False
    ).order_by('-created_at').first()

    if not otp_record:
        return Response(
            {'error': '找不到待驗證的OTP，請重新發送驗證碼'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Check expiration
    if otp_record.is_expired():
        return Response(
            {'error': '驗證碼已過期，請重新獲取'},
            status=status.HTTP_410_GONE
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

    # OTP is valid - create user account
    with transaction.atomic():
        # Check again if phone was registered during verification (race condition)
        if StudentProfile.objects.filter(phone_number=phone_number).exists():
            return Response(
                {'error': '此電話號碼已註冊'},
                status=status.HTTP_409_CONFLICT
            )

        # Create User with username=phone_number
        user = User.objects.create_user(
            username=phone_number,
            password=password
        )

        # Create StudentProfile
        profile = StudentProfile.objects.create(
            user=user,
            phone_number=phone_number,
            phone_verified=True,  # Phone is verified
            verified=False  # Email not verified yet (can be added later)
        )

        # Claim pending coupons for this phone
        coupons_claimed = Coupon.objects.filter(
            pending_phone_number=phone_number,
            current_holder__isnull=True
        ).update(
            current_holder=user,
            pending_phone_number=None,
            acquisition_method='consolidate'
        )

        # Mark OTP as verified
        otp_record.is_verified = True
        otp_record.save()

        # Clean up old registration OTP records for this phone
        PhoneOTPRecord.cleanup_old_records(
            phone_number=phone_number,
            user=None,
            purpose='registration'
        )

        # Generate JWT tokens for auto-login
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

    response_data = {
        'message': '註冊成功！歡迎加入 CouPro',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'username': user.username,
            'phone_number': phone_number,
            'phone_verified': True
        }
    }

    if coupons_claimed > 0:
        response_data['coupons_claimed'] = coupons_claimed

    return Response(response_data, status=status.HTTP_201_CREATED)


# ===== PASSWORD RESET OTP ENDPOINTS (Unauthenticated) =====

@api_view(['POST'])
@permission_classes([AllowAny])
def send_password_reset_otp(request):
    """
    Send password reset OTP to registered phone number (unauthenticated).
    
    Validates:
    - Phone number is registered
    - Rate limits
    
    Returns 200 on success, 400 for validation errors, 404 if phone not found, 429 for rate limits.
    """
    serializer = PhoneForgotPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        errors = serializer.errors
        error_message = next(iter(errors.values()))[0]
        return Response(
            {'error': str(error_message)},
            status=status.HTTP_400_BAD_REQUEST
        )

    phone_number = serializer.validated_data['phone_number']

    # Check if phone is registered
    profile = StudentProfile.objects.filter(phone_number=phone_number).first()
    if not profile:
        return Response(
            {'error': '此電話號碼尚未註冊'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Check rate limits for password_reset purpose
    can_send, error_message, retry_after = PhoneOTPRecord.can_send_otp(
        phone_number,
        purpose='password_reset'
    )
    if not can_send:
        return Response(
            {'error': error_message, 'retry_after_seconds': retry_after},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    # Create OTP record with purpose='password_reset', user=profile.user
    otp_record = PhoneOTPRecord.create_otp(
        user=profile.user,
        phone_number=phone_number,
        purpose='password_reset'
    )

    # Send SMS
    sms_service = SMSService()
    result = sms_service.send_otp(phone_number, otp_record.otp_code)

    if not result['success']:
        otp_record.delete()
        return Response(
            {'error': result.get('error', 'SMS發送失敗，請稍後再試')},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    masked_phone = mask_phone_number(phone_number)
    response_data = {
        'message': f'重設密碼驗證碼已發送至 {masked_phone}',
        'cooldown_seconds': 60,
        'expires_in_seconds': 600
    }

    # Include dev mode info for testing
    if result.get('dev_mode'):
        response_data['dev_mode'] = True
        response_data['otp_code'] = result.get('otp_code')

    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_password_reset_otp(request):
    """
    Verify OTP and reset password for phone-registered user (unauthenticated).
    
    On success:
    1. Verify OTP with purpose='password_reset'
    2. Update user's password
    3. Return success message
    
    Returns 200 on success, 400 for invalid OTP, 404 if no OTP found, 410 if expired.
    """
    serializer = PhoneResetPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        errors = serializer.errors
        error_message = next(iter(errors.values()))[0]
        return Response(
            {'error': str(error_message)},
            status=status.HTTP_400_BAD_REQUEST
        )

    phone_number = serializer.validated_data['phone_number']
    otp_code = serializer.validated_data['otp_code']
    new_password = serializer.validated_data['new_password']

    # Check if phone is registered
    profile = StudentProfile.objects.filter(phone_number=phone_number).first()
    if not profile:
        return Response(
            {'error': '此電話號碼尚未註冊'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Find the most recent pending password_reset OTP for this phone
    otp_record = PhoneOTPRecord.objects.filter(
        phone_number=phone_number,
        purpose='password_reset',
        is_verified=False
    ).order_by('-created_at').first()

    if not otp_record:
        return Response(
            {'error': '找不到待驗證的OTP，請重新發送驗證碼'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Check expiration
    if otp_record.is_expired():
        return Response(
            {'error': '驗證碼已過期，請重新獲取'},
            status=status.HTTP_410_GONE
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

    # OTP is valid - reset password
    with transaction.atomic():
        user = profile.user
        user.set_password(new_password)
        user.save()

        # Mark OTP as verified
        otp_record.is_verified = True
        otp_record.save()

        # Clean up old password_reset OTP records for this phone/user
        PhoneOTPRecord.cleanup_old_records(
            phone_number=phone_number,
            user=user,
            purpose='password_reset'
        )

    return Response(
        {'message': '密碼已重設成功，請使用新密碼登入'},
        status=status.HTTP_200_OK
    )
