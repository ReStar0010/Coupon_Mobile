import logging
import secrets

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth.models import User
from django.http import HttpResponse
from urllib.parse import urlencode

from ...serializers import RequestEmailVerificationSerializer
from ...models import StudentProfile, MerchantProfile
from ...exceptions import (
    EmailAlreadyExists,
    MissingToken,
    InvalidToken,
    AlreadyVerified,
    ExpiredToken,
    EmailSendFailed,
)
from .email_helpers import send_verification_email, send_merchant_verification_email

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow anyone with the token to access
def verify_email(request):
    token = request.GET.get('token')
    if not token:
        raise MissingToken(developer_message="Missing token")
    try:
        # Find the profile by the token
        profile = StudentProfile.objects.get(email_verification_token=token)

        if profile.verified:
            return Response({"message": "Email already verified"})

        # Mark as verified and clear the token
        profile.verified = True
        profile.email_verification_token = None  # Clear token after verification
        profile.save()

        return Response({"message": "Email verified successfully"})
    except StudentProfile.DoesNotExist:
        raise InvalidToken(developer_message="Invalid or expired token")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_email_verification(request):
    """
    Logged-in user adds or changes email; send verification email.
    Used by optional email settings (009-phone-registration User Story 3).
    """
    serializer = RequestEmailVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data['email'].strip().lower()

    # Email already used by another user (User.email is unique)
    if User.objects.filter(email=email).exclude(pk=request.user.pk).exists():
        raise EmailAlreadyExists(developer_message="此信箱已被其他帳號使用")

    try:
        profile = request.user.student_profile
    except StudentProfile.DoesNotExist:
        raise PermissionDenied("僅限一般使用者可設定 Email")

    token = secrets.token_urlsafe(32)
    request.user.email = email
    request.user.save(update_fields=['email'])
    profile.email_verification_token = token
    profile.verified = False
    profile.save(update_fields=['email_verification_token', 'verified'])

    try:
        send_verification_email(email, token)
    except Exception as e:
        logger.exception("Failed to send verification email to %s: %s", email, e)
        raise EmailSendFailed(developer_message="驗證信件發送失敗，請稍後再試")

    return Response(
        {'message': '驗證信件已發送，請至信箱點擊連結完成驗證'},
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_merchant_email(request):
    """Verify merchant email address using token from verification email."""
    token = request.GET.get('token')
    if not token:
        raise MissingToken(developer_message="缺少驗證碼")

    try:
        merchant_profile = MerchantProfile.objects.get(email_verification_token=token)

        # Check if already verified
        if merchant_profile.verified:
            raise AlreadyVerified(developer_message="此帳號已經驗證過了。")

        # Check if token is expired
        if not merchant_profile.is_verification_token_valid():
            raise ExpiredToken(developer_message="驗證連結已過期，請重新申請驗證郵件。")

        # Mark as verified
        merchant_profile.verify_email()

        return Response({
            'success': True,
            'message': '電子郵件驗證成功！您現在可以登入。'
        }, status=status.HTTP_200_OK)

    except MerchantProfile.DoesNotExist:
        raise InvalidToken(developer_message="驗證連結無效或已過期，請重新申請驗證郵件。")


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_merchant_verification(request):
    """Resend verification email to unverified merchant account."""
    email = request.data.get('email')

    if not email:
        return Response({
            'error': 'missing_email',
            'message': '請提供電子郵件地址'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Generic response to prevent email enumeration
    generic_response = Response({
        'success': True,
        'message': '如果此電子郵件存在且尚未驗證，驗證郵件將會發送到該地址。'
    }, status=status.HTTP_200_OK)

    try:
        user = User.objects.get(email=email)

        # Check if user is a merchant
        if not user.groups.filter(name='Merchant').exists():
            return generic_response

        merchant_profile = MerchantProfile.objects.get(user=user)

        # If already verified, return generic response
        if merchant_profile.verified:
            return generic_response

        # Generate new token and send email
        token = merchant_profile.generate_verification_token()
        try:
            send_merchant_verification_email(email, token)
        except Exception as email_error:
            raise EmailSendFailed(developer_message=str(email_error))

        return generic_response

    except (User.DoesNotExist, MerchantProfile.DoesNotExist):
        # Return generic response even if user doesn't exist (prevent enumeration)
        return generic_response


@api_view(['GET'])
@permission_classes([AllowAny])
def redirect_verify_email(request):
    """
    Redirect from HTTPS URL to coupromerchant:// deep link for email verification.
    This endpoint is used in verification emails to ensure the link is clickable.
    Uses manual Location header because Django blocks redirects to custom URL schemes.
    """
    token = request.GET.get('token', '')
    email = request.GET.get('email', '')

    # Build the deep link URL
    params = urlencode({'token': token, 'email': email})
    deep_link = f"coupromerchant://verify-email?{params}"

    # Use HttpResponse with 302 status and Location header to bypass Django's URL scheme check
    response = HttpResponse(status=302)
    response['Location'] = deep_link
    return response
