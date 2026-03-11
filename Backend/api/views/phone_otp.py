"""
Phone OTP verification views.
Handles OTP send and verify endpoints for phone number verification.
Includes unauthenticated endpoints for registration and password reset.

Errors use api.exceptions (CouProAPIException) so responses follow:
  {"error_code": str, "developer_message": str, "context": dict}
Frontend maps error_code to zh-TW via useApiError / errors.* in translation.json.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

from api.exceptions import (
    PhoneAlreadyUsedByOther,
    PhoneAlreadyRegistered,
    PhoneNotRegistered,
    OTPNotFound,
    OTPExpired,
    OTPMaxAttempts,
    OTPInvalid,
    OTPRateLimited,
    SmsSendFailed,
)
from api.models import PhoneOTPRecord, StudentProfile, Coupon
from api.serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    RegistrationOTPSendSerializer,
    RegistrationOTPVerifySerializer,
    PhoneForgotPasswordSerializer,
    PhoneResetPasswordSerializer,
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
    serializer.is_valid(raise_exception=True)
    phone_number = serializer.validated_data['phone_number']

    # Check if phone is registered to another user
    existing_profile = StudentProfile.objects.filter(
        phone_number=phone_number
    ).exclude(user=request.user).first()
    if existing_profile:
        raise PhoneAlreadyUsedByOther(
            developer_message="Phone number already linked to another account."
        )

    # Check rate limits
    can_send, _error_message, retry_after = PhoneOTPRecord.can_send_otp(phone_number)
    if not can_send:
        raise OTPRateLimited(
            developer_message="OTP send rate limit exceeded.",
            context={"retry_after_seconds": retry_after or 60},
        )

    # Create OTP record
    otp_record = PhoneOTPRecord.create_otp(request.user, phone_number)

    # Send SMS
    sms_service = SMSService()
    result = sms_service.send_otp(phone_number, otp_record.otp_code)
    if not result['success']:
        otp_record.delete()
        raise SmsSendFailed(
            developer_message=result.get('error', "SMS delivery failed.")
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
    serializer.is_valid(raise_exception=True)
    phone_number = serializer.validated_data['phone_number']
    otp_code = serializer.validated_data['otp_code']

    # Find the most recent pending OTP for this phone/user
    otp_record = PhoneOTPRecord.objects.filter(
        user=request.user,
        phone_number=phone_number,
        is_verified=False,
    ).order_by('-created_at').first()
    if not otp_record:
        raise OTPNotFound(developer_message="No pending OTP found for this user/phone.")

    if otp_record.is_expired():
        raise OTPExpired(developer_message="OTP has expired.")

    if not otp_record.can_attempt():
        raise OTPMaxAttempts(developer_message="Max OTP verification attempts exceeded.")

    if otp_record.otp_code != otp_code:
        otp_record.increment_attempt()
        attempts_remaining = 5 - otp_record.attempt_count
        raise OTPInvalid(
            developer_message="OTP code mismatch.",
            context={"attempts_remaining": attempts_remaining},
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
    serializer.is_valid(raise_exception=True)
    phone_number = serializer.validated_data['phone_number']

    existing_profile = StudentProfile.objects.filter(phone_number=phone_number).first()
    if existing_profile:
        raise PhoneAlreadyRegistered(
            developer_message="Phone number already registered."
        )

    can_send, _error_message, retry_after = PhoneOTPRecord.can_send_otp(
        phone_number,
        purpose='registration',
    )
    if not can_send:
        raise OTPRateLimited(
            developer_message="Registration OTP rate limit exceeded.",
            context={"retry_after_seconds": retry_after or 60},
        )

    otp_record = PhoneOTPRecord.create_otp(
        user=None,
        phone_number=phone_number,
        purpose='registration',
    )
    sms_service = SMSService()
    result = sms_service.send_otp(phone_number, otp_record.otp_code)
    if not result['success']:
        otp_record.delete()
        raise SmsSendFailed(
            developer_message=result.get('error', "SMS delivery failed.")
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
    serializer.is_valid(raise_exception=True)
    phone_number = serializer.validated_data['phone_number']
    otp_code = serializer.validated_data['otp_code']
    password = serializer.validated_data['password']

    otp_record = PhoneOTPRecord.objects.filter(
        phone_number=phone_number,
        purpose='registration',
        is_verified=False,
    ).order_by('-created_at').first()
    if not otp_record:
        raise OTPNotFound(developer_message="No pending registration OTP for this phone.")

    if otp_record.is_expired():
        raise OTPExpired(developer_message="Registration OTP has expired.")

    if not otp_record.can_attempt():
        raise OTPMaxAttempts(developer_message="Max OTP verification attempts exceeded.")

    if otp_record.otp_code != otp_code:
        otp_record.increment_attempt()
        attempts_remaining = 5 - otp_record.attempt_count
        raise OTPInvalid(
            developer_message="OTP code mismatch.",
            context={"attempts_remaining": attempts_remaining},
        )

    # OTP is valid - create user account
    with transaction.atomic():
        if StudentProfile.objects.filter(phone_number=phone_number).exists():
            raise PhoneAlreadyRegistered(
                developer_message="Phone was registered during verification (race)."
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
    serializer.is_valid(raise_exception=True)
    phone_number = serializer.validated_data['phone_number']

    profile = StudentProfile.objects.filter(phone_number=phone_number).first()
    if not profile:
        raise PhoneNotRegistered(
            developer_message="Phone number not registered."
        )

    can_send, _error_message, retry_after = PhoneOTPRecord.can_send_otp(
        phone_number,
        purpose='password_reset',
    )
    if not can_send:
        raise OTPRateLimited(
            developer_message="Password reset OTP rate limit exceeded.",
            context={"retry_after_seconds": retry_after or 60},
        )

    otp_record = PhoneOTPRecord.create_otp(
        user=profile.user,
        phone_number=phone_number,
        purpose='password_reset',
    )
    sms_service = SMSService()
    result = sms_service.send_otp(phone_number, otp_record.otp_code)
    if not result['success']:
        otp_record.delete()
        raise SmsSendFailed(
            developer_message=result.get('error', "SMS delivery failed.")
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
    serializer.is_valid(raise_exception=True)
    phone_number = serializer.validated_data['phone_number']
    otp_code = serializer.validated_data['otp_code']
    new_password = serializer.validated_data['new_password']

    profile = StudentProfile.objects.filter(phone_number=phone_number).first()
    if not profile:
        raise PhoneNotRegistered(
            developer_message="Phone number not registered."
        )

    otp_record = PhoneOTPRecord.objects.filter(
        phone_number=phone_number,
        purpose='password_reset',
        is_verified=False,
    ).order_by('-created_at').first()
    if not otp_record:
        raise OTPNotFound(
            developer_message="No pending password-reset OTP for this phone."
        )

    if otp_record.is_expired():
        raise OTPExpired(developer_message="Password reset OTP has expired.")

    if not otp_record.can_attempt():
        raise OTPMaxAttempts(developer_message="Max OTP verification attempts exceeded.")

    if otp_record.otp_code != otp_code:
        otp_record.increment_attempt()
        attempts_remaining = 5 - otp_record.attempt_count
        raise OTPInvalid(
            developer_message="OTP code mismatch.",
            context={"attempts_remaining": attempts_remaining},
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
