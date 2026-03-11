import logging

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
import secrets
from django.utils import timezone
from datetime import timedelta
from .models import PasswordResetProfile

logger = logging.getLogger(__name__)

class CookieJWTAuthentication(JWTAuthentication):
    """
    從 cookie 中獲取 JWT token 進行驗證的自定義認證類
    """
    def authenticate(self, request):
        # 從 cookie 中獲取 token
        token = request.COOKIES.get('auth_token')
        if not token:
            return None
             
        # 驗證 token
        try:
            validated_token = self.get_validated_token(token)
            user = self.get_user(validated_token)
            return (user, validated_token)
        except Exception as e:
            # 驗證失敗，視為未認證
            logger.warning("Cookie JWT authentication failed: %s", e)
            return None

def generate_password_reset_token():
    """
    Generate a secure token for password reset
    """
    return secrets.token_urlsafe(32)

def is_token_valid(reset_profile):
    """
    Check if a password reset token is still valid (less than 24 hours old)
    """
    if not reset_profile or not reset_profile.token_created_at:
        return False
    
    expiry_time = reset_profile.token_created_at + timedelta(hours=24)
    return timezone.now() < expiry_time

def get_or_create_reset_profile(user):
    """
    Get or create a password reset profile for a user
    """
    try:
        return PasswordResetProfile.objects.get(user=user)
    except PasswordResetProfile.DoesNotExist:
        return PasswordResetProfile.objects.create(user=user)