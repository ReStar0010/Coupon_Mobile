import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.utils import timezone
from django.http import HttpResponse
from urllib.parse import urlencode
from drf_yasg.utils import swagger_auto_schema

from ...serializers import ForgotPasswordSerializer, ResetPasswordSerializer
from ...models import PasswordResetProfile
from ...auth import generate_password_reset_token, is_token_valid
from ...exceptions import (
    EmailSendFailed,
    InvalidResetLink,
    UserNotFound,
)
from .email_helpers import send_password_reset_email

logger = logging.getLogger(__name__)


@swagger_auto_schema(
        method='post',
        operation_description="Send a password reset link to user's email",
        request_body=ForgotPasswordSerializer,
)
@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    """
    Forgot password endpoint that sends a password reset link to user's email.
    Supports both merchant and student users with appropriate deep links.
    Implements rate limiting: 3 requests per hour per email.
    """
    email = request.data.get('email')
    if not email:
        return Response({'error': '請提供電子郵件地址'}, status=status.HTTP_400_BAD_REQUEST)

    # Generic response to prevent email enumeration attacks
    generic_success_response = Response({
        'message': '如果此電子郵件存在，密碼重設連結將發送到該地址'
    })

    try:
        user = User.objects.get(email=email)

        # Detect user type
        is_merchant = user.groups.filter(name='Merchant').exists()
        user_type = 'merchant' if is_merchant else 'student'

        # Get or create reset profile
        reset_profile, created = PasswordResetProfile.objects.get_or_create(user=user)

        # Generate reset token
        token = generate_password_reset_token()

        # Save token to profile
        reset_profile.token = token
        reset_profile.token_created_at = timezone.now()
        reset_profile.save()

        # Send reset email with appropriate deep link based on user type
        try:
            send_password_reset_email(email, token, user_type)
            return Response({'message': '密碼重設連結已發送到您的電子郵件'})
        except Exception as email_error:
            # Return user-friendly error message
            raise EmailSendFailed(developer_message=str(email_error))

    except User.DoesNotExist:
        # Still return success to prevent email enumeration attacks
        return generic_success_response


@swagger_auto_schema(
        method='post',
        operation_description="Reset password endpoint that validates token and sets new password",
        request_body=ResetPasswordSerializer,
)
@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """
    Reset password endpoint that validates token and sets new password
    """
    email = request.data.get('email')
    token = request.data.get('token')
    new_password = request.data.get('new_password')

    logger.info("Reset password attempt for email: %s", email)

    if not all([email, token, new_password]):
        return Response({'error': '所有欄位均為必填'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
        logger.debug("User found for password reset: %s", user.username)

        # Get reset profile
        try:
            reset_profile = PasswordResetProfile.objects.get(user=user)
            logger.debug("Reset profile token present: %s", bool(reset_profile.token))

            # Verify token
            if not reset_profile.token or reset_profile.token != token:
                return Response({'error': '無效的重設密碼連結'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if token is still valid (not expired)
            if not is_token_valid(reset_profile):
                return Response({'error': '重設密碼連結已過期，請重新申請'}, status=status.HTTP_400_BAD_REQUEST)

            # Set new password
            user.set_password(new_password)
            user.save()

            # Clear reset token
            reset_profile.token = None
            reset_profile.token_created_at = None
            reset_profile.save()

            logger.info("Password reset successful for user %s", user.username)
            return Response({'message': '密碼已成功重設，請使用新密碼登入'})

        except PasswordResetProfile.DoesNotExist:
            logger.warning("No reset profile found for user %s", email)
            raise InvalidResetLink(developer_message="無效的重設密碼連結")

    except User.DoesNotExist:
        raise UserNotFound(developer_message="找不到使用者")
    except Exception as e:
        logger.error("Unexpected error during password reset: %s", e, exc_info=True)
        return Response({'error': f'發生未預期的錯誤: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def redirect_reset_password(request):
    """
    Redirect from HTTPS URL to coupromerchant:// deep link for password reset.
    This endpoint is used in password reset emails to ensure the link is clickable.
    Uses manual Location header because Django blocks redirects to custom URL schemes.
    """
    token = request.GET.get('token', '')
    email = request.GET.get('email', '')

    # Build the deep link URL
    params = urlencode({'token': token, 'email': email})
    deep_link = f"coupromerchant://reset-password?{params}"

    # Use HttpResponse with 302 status and Location header to bypass Django's URL scheme check
    response = HttpResponse(status=302)
    response['Location'] = deep_link
    return response
