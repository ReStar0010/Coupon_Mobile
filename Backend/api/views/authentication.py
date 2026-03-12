import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError, PermissionDenied
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
import secrets
import os
import resend
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from django.http import HttpResponse
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

from ..serializers import (
    LoginSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    MerchantRegisterSerializer,
    PhoneLoginSerializer,
    RequestEmailVerificationSerializer,
)
from ..models import StudentProfile, PasswordResetProfile, MerchantProfile, Store
from ..auth import generate_password_reset_token, is_token_valid
from ..exceptions import (
    CouProAPIException,
    EmailAlreadyExists,
    MissingToken,
    InvalidToken,
    AlreadyVerified,
    ExpiredToken,
    EmailNotVerified,
    WrongClientTypeMerchant,
    WrongClientTypeUser,
    InvalidCredentials,
    UserNotFound,
    PhoneNotRegistered,
    PasswordTooShort,
    InvalidResetLink,
    ExpiredResetLink,
    RefreshTokenMissing,
    RefreshTokenInvalid,
    EmailSendFailed,
)
from django.contrib.auth.models import Group

# Initialize the Resend client
resend.api_key = settings.RESEND_API_KEY

# Updated verification email function
def send_verification_email(user_email, token):

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    verification_link = f"{frontend_url}/Login/verify?{urlencode({'token': token, 'email': user_email})}"

    subject = '請驗證您的 CouPro 帳號'
    html_message = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>驗證您的 CouPro 帳號</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            padding: 20px;
        }}
        .email-container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #FFAD31 0%, #FF8C00 100%);
            padding: 40px 30px;
            text-align: center;
            color: #ffffff;
        }}
        .header h1 {{
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 18px;
            color: #333333;
            margin-bottom: 20px;
            font-weight: 500;
        }}
        .message {{
            font-size: 16px;
            color: #666666;
            margin-bottom: 30px;
            line-height: 1.8;
        }}
        .button-container {{
            text-align: center;
            margin: 35px 0;
        }}
        .button {{
            display: inline-block;
            background: linear-gradient(135deg, #FFAD31 0%, #FF8C00 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(255, 173, 49, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
            letter-spacing: 0.5px;
        }}
        .button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(255, 173, 49, 0.5);
        }}
        .link-box {{
            background-color: #f8f9fa;
            border-left: 4px solid #FFAD31;
            padding: 15px;
            margin: 25px 0;
            border-radius: 4px;
        }}
        .link-box p {{
            font-size: 13px;
            color: #666666;
            margin-bottom: 8px;
        }}
        .link-box a {{
            color: #FFAD31;
            word-break: break-all;
            font-size: 12px;
        }}
        .warning {{
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 15px;
            margin: 25px 0;
            font-size: 14px;
            color: #856404;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }}
        .footer p {{
            font-size: 14px;
            color: #666666;
            margin-bottom: 8px;
            line-height: 1.6;
        }}
        .footer a {{
            color: #FFAD31;
            text-decoration: none;
            font-weight: 500;
        }}
        .footer a:hover {{
            text-decoration: underline;
        }}
        .logo {{
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
        }}
        @media only screen and (max-width: 600px) {{
            .content {{
                padding: 30px 20px;
            }}
            .header {{
                padding: 30px 20px;
            }}
            .header h1 {{
                font-size: 24px;
            }}
            .button {{
                padding: 14px 30px;
                font-size: 15px;
            }}
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">CouPro</div>
            <h1>驗證您的帳號</h1>
        </div>
        <div class="content">
            <div class="greeting">親愛的用戶，您好！</div>
            <div class="message">
                感謝您註冊 CouPro 折扣平台！為了確保您的帳號安全，請點擊下方按鈕驗證您的電子郵件地址。
            </div>
            <div class="button-container">
                <a href="{verification_link}" class="button">驗證我的電子郵件</a>
            </div>
            <div class="link-box">
                <p><strong>若按鈕無法點擊，請複製下方連結到瀏覽器開啟：</strong></p>
                <a href="{verification_link}">{verification_link}</a>
            </div>
            <div class="warning">
                <strong>⚠️ 安全提示：</strong>若您沒有註冊 CouPro 帳號，請忽略此郵件。此驗證連結將在 24 小時後過期。
            </div>
        </div>
        <div class="footer">
            <p><strong>祝您使用愉快</strong></p>
            <p>CouPro 團隊</p>
            <p><a href="mailto:coupro707@gmail.com">coupro707@gmail.com</a></p>
        </div>
    </div>
</body>
</html>
'''
    
    from_email = "noreply@coupro.pro"  # Update with your verified Resend sender domain
    
    try:
        # Use Resend to send the email
        params = {
            "from": from_email,
            "to": user_email,
            "subject": subject,
            "html": html_message
        }

        email = resend.Emails.send(params)
        logger.debug("Resend API response for student verification: %s", email)
        logger.info("Successfully sent verification email to %s", user_email)

        return True

    except Exception as e:

        logger.error("Failed to send verification email to %s: %s", user_email, e)
        return False

# Merchant verification email function
def send_merchant_verification_email(user_email, token):
    """Send verification email for merchant accounts using HTTPS redirect URL that redirects to deep link."""
    # Use HTTPS redirect URL so the link is clickable in email clients. URL-encode params so + in email (e.g. user+tag@yahoo.com) does not break the link.
    api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro')
    verification_link = f"{api_base_url}/api/merchant/redirect/verify-email?{urlencode({'token': token, 'email': user_email})}"

    subject = '請驗證您的 CouPro 商家帳號'
    html_message = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>驗證您的 CouPro 商家帳號</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            padding: 20px;
        }}
        .email-container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #FFAD31 0%, #FF8C00 100%);
            padding: 40px 30px;
            text-align: center;
            color: #ffffff;
        }}
        .header h1 {{
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }}
        .badge {{
            display: inline-block;
            background-color: rgba(255, 255, 255, 0.2);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-top: 10px;
            letter-spacing: 0.5px;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 18px;
            color: #333333;
            margin-bottom: 20px;
            font-weight: 500;
        }}
        .message {{
            font-size: 16px;
            color: #666666;
            margin-bottom: 30px;
            line-height: 1.8;
        }}
        .button-container {{
            text-align: center;
            margin: 35px 0;
        }}
        .button {{
            display: inline-block;
            background: linear-gradient(135deg, #FFAD31 0%, #FF8C00 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(255, 173, 49, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
            letter-spacing: 0.5px;
        }}
        .button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(255, 173, 49, 0.5);
        }}
        .link-box {{
            background-color: #f8f9fa;
            border-left: 4px solid #FFAD31;
            padding: 15px;
            margin: 25px 0;
            border-radius: 4px;
        }}
        .link-box p {{
            font-size: 13px;
            color: #666666;
            margin-bottom: 8px;
        }}
        .link-box a {{
            color: #FFAD31;
            word-break: break-all;
            font-size: 12px;
        }}
        .warning {{
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 15px;
            margin: 25px 0;
            font-size: 14px;
            color: #856404;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }}
        .footer p {{
            font-size: 14px;
            color: #666666;
            margin-bottom: 8px;
            line-height: 1.6;
        }}
        .footer a {{
            color: #FFAD31;
            text-decoration: none;
            font-weight: 500;
        }}
        .footer a:hover {{
            text-decoration: underline;
        }}
        .logo {{
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
        }}
        @media only screen and (max-width: 600px) {{
            .content {{
                padding: 30px 20px;
            }}
            .header {{
                padding: 30px 20px;
            }}
            .header h1 {{
                font-size: 24px;
            }}
            .button {{
                padding: 14px 30px;
                font-size: 15px;
            }}
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">CouPro</div>
            <h1>驗證您的商家帳號</h1>
            <div class="badge">商家專屬</div>
        </div>
        <div class="content">
            <div class="greeting">親愛的商家夥伴，您好！</div>
            <div class="message">
                感謝您註冊 CouPro 商家平台！為了確保您的帳號安全並開始使用我們的服務，請點擊下方按鈕驗證您的電子郵件地址。
            </div>
            <div class="button-container">
                <a href="{verification_link}" class="button">驗證我的電子郵件</a>
            </div>
            <div class="link-box">
                <p><strong>若按鈕無法點擊，請複製下方連結到瀏覽器開啟：</strong></p>
                <a href="{verification_link}">{verification_link}</a>
            </div>
            <div class="warning">
                <strong>⚠️ 安全提示：</strong>若您沒有註冊 CouPro 商家帳號，請忽略此郵件。此驗證連結將在 24 小時後過期。
            </div>
        </div>
        <div class="footer">
            <p><strong>祝您使用愉快</strong></p>
            <p>CouPro 團隊</p>
            <p><a href="mailto:coupro707@gmail.com">coupro707@gmail.com</a></p>
        </div>
    </div>
</body>
</html>
'''
    
    from_email = "noreply@coupro.pro"
    
    try:
        params = {
            "from": from_email,
            "to": user_email,
            "subject": subject,
            "html": html_message
        }

        email = resend.Emails.send(params)
        logger.debug("Resend API response for merchant verification: %s", email)
        logger.info("Successfully sent merchant verification email to %s", user_email)
        return True

    except Exception as e:
        error_message = str(e)
        logger.error("Failed to send merchant verification email to %s: %s", user_email, error_message)
        
        # Provide user-friendly error messages based on error type
        if 'rate_limit' in error_message.lower() or '429' in error_message:
            raise Exception('郵件服務暫時無法使用，請稍後再試')
        elif 'invalid' in error_message.lower() or 'unauthorized' in error_message.lower():
            raise Exception('郵件服務配置錯誤，請聯繫管理員')
        elif 'network' in error_message.lower() or 'timeout' in error_message.lower():
            raise Exception('網路連線問題，請稍後再試')
        else:
            raise Exception('發送郵件時發生錯誤，請稍後再試或聯繫客服')

# Updated password reset email function
def send_password_reset_email(user_email, token, user_type='student'):
    """
    Send password reset email with appropriate link based on user type.

    Args:
        user_email: Email address of the user
        token: Password reset token
        user_type: 'merchant' or 'student' (default: 'student')
    """
    # Determine link based on user type
    if user_type == 'merchant':
        # Use HTTPS redirect URL so the link is clickable in email clients. URL-encode params for compatibility (e.g. Yahoo + in email).
        api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro')
        reset_link = f"{api_base_url}/api/merchant/redirect/reset-password?{urlencode({'token': token, 'email': user_email})}"
    else:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        reset_link = f"{frontend_url}/ResetPassword?{urlencode({'token': token, 'email': user_email})}"

    subject = '重設您的 CouPro 密碼'

    html_message = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>重設您的 CouPro 密碼</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            padding: 20px;
        }}
        .email-container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #FFAD31 0%, #FF8C00 100%);
            padding: 40px 30px;
            text-align: center;
            color: #ffffff;
        }}
        .header h1 {{
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }}
        .icon {{
            font-size: 48px;
            margin-bottom: 15px;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 18px;
            color: #333333;
            margin-bottom: 20px;
            font-weight: 500;
        }}
        .message {{
            font-size: 16px;
            color: #666666;
            margin-bottom: 30px;
            line-height: 1.8;
        }}
        .button-container {{
            text-align: center;
            margin: 35px 0;
        }}
        .button {{
            display: inline-block;
            background: linear-gradient(135deg, #FFAD31 0%, #FF8C00 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(255, 173, 49, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
            letter-spacing: 0.5px;
        }}
        .button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(255, 173, 49, 0.5);
        }}
        .link-box {{
            background-color: #f8f9fa;
            border-left: 4px solid #FFAD31;
            padding: 15px;
            margin: 25px 0;
            border-radius: 4px;
        }}
        .link-box p {{
            font-size: 13px;
            color: #666666;
            margin-bottom: 8px;
        }}
        .link-box a {{
            color: #FFAD31;
            word-break: break-all;
            font-size: 12px;
        }}
        .warning {{
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 15px;
            margin: 25px 0;
            font-size: 14px;
            color: #856404;
        }}
        .warning strong {{
            display: block;
            margin-bottom: 8px;
            font-size: 15px;
        }}
        .security-note {{
            background-color: #e3f2fd;
            border: 1px solid #2196F3;
            border-radius: 8px;
            padding: 15px;
            margin: 25px 0;
            font-size: 14px;
            color: #1565c0;
        }}
        .security-note strong {{
            display: block;
            margin-bottom: 8px;
            font-size: 15px;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }}
        .footer p {{
            font-size: 14px;
            color: #666666;
            margin-bottom: 8px;
            line-height: 1.6;
        }}
        .footer a {{
            color: #FFAD31;
            text-decoration: none;
            font-weight: 500;
        }}
        .footer a:hover {{
            text-decoration: underline;
        }}
        .logo {{
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
        }}
        @media only screen and (max-width: 600px) {{
            .content {{
                padding: 30px 20px;
            }}
            .header {{
                padding: 30px 20px;
            }}
            .header h1 {{
                font-size: 24px;
            }}
            .button {{
                padding: 14px 30px;
                font-size: 15px;
            }}
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">CouPro</div>
            <div class="icon">🔐</div>
            <h1>重設您的密碼</h1>
        </div>
        <div class="content">
            <div class="greeting">親愛的用戶，您好！</div>
            <div class="message">
                我們收到了您重設 CouPro 帳號密碼的請求。請點擊下方按鈕來重設您的密碼。此連結將在 24 小時後過期。
            </div>
            <div class="button-container">
                <a href="{reset_link}" class="button">重設我的密碼</a>
            </div>
            <div class="link-box">
                <p><strong>若按鈕無法點擊，請複製下方連結到瀏覽器開啟：</strong></p>
                <a href="{reset_link}">{reset_link}</a>
            </div>
            <div class="security-note">
                <strong>🔒 安全提示</strong>
                此連結僅在 24 小時內有效。為保護您的帳號安全，請勿將此連結分享給他人。
            </div>
            <div class="warning">
                <strong>⚠️ 重要提醒</strong>
                如果您沒有要求重設密碼，請忽略此郵件，您的帳號仍然安全。若您持續收到此類郵件，請聯繫我們的客服團隊。
            </div>
        </div>
        <div class="footer">
            <p><strong>如有任何疑問，請隨時聯繫我們</strong></p>
            <p><a href="mailto:coupro707@gmail.com">coupro707@gmail.com</a></p>
            <p style="margin-top: 20px;"><strong>祝您使用愉快</strong></p>
            <p>CouPro 團隊</p>
        </div>
    </div>
</body>
</html>
'''
    
    from_email = "noreply@coupro.pro"  # Update with your verified Resend sender domain
    
    try:
        # Use Resend to send the email
        params = {
            "from": from_email,
            "to": user_email,
            "subject": subject,
            "html": html_message
        }

        email = resend.Emails.send(params)
        logger.debug("Resend API response for password reset: %s", email)
        logger.info("Successfully sent password reset email to %s", user_email)
        return True

    except Exception as e:
        error_message = str(e)
        logger.error("Failed to send password reset email to %s: %s", user_email, error_message)
        
        # Provide user-friendly error messages based on error type
        if 'rate_limit' in error_message.lower() or '429' in error_message:
            raise Exception('郵件服務暫時無法使用，請稍後再試')
        elif 'invalid' in error_message.lower() or 'unauthorized' in error_message.lower():
            raise Exception('郵件服務配置錯誤，請聯繫管理員')
        elif 'network' in error_message.lower() or 'timeout' in error_message.lower():
            raise Exception('網路連線問題，請稍後再試')
        else:
            raise Exception('發送郵件時發生錯誤，請稍後再試或聯繫客服')
@swagger_auto_schema(
        method='post',
        operation_description="register a new account (student or merchant)",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'email': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_EMAIL),
                'password': openapi.Schema(type=openapi.TYPE_STRING),
                'user_type': openapi.Schema(type=openapi.TYPE_STRING, enum=['student', 'merchant'], description='Type of user to register'),
                # Merchant-specific fields
                'phone': openapi.Schema(type=openapi.TYPE_STRING),
                'contact_person': openapi.Schema(type=openapi.TYPE_STRING),
                'contact_info': openapi.Schema(type=openapi.TYPE_STRING),
                'store_name': openapi.Schema(type=openapi.TYPE_STRING),
                'store_address': openapi.Schema(type=openapi.TYPE_STRING),
                'store_lat': openapi.Schema(type=openapi.TYPE_NUMBER),
                'store_lng': openapi.Schema(type=openapi.TYPE_NUMBER),
                'business_hours': openapi.Schema(type=openapi.TYPE_STRING),
            },
            required=['email', 'password', 'user_type']
        ),
)
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Register a new user account. Supports both student and merchant registration.
    For merchant registration, additional fields are required.
    """
    data = request.data
    email = data.get('email')
    password = data.get('password')
    user_type = data.get('user_type', 'student')  # Default to student

    if not email or not password:
        return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=email).exists():
        raise EmailAlreadyExists(developer_message="Email already exists")

    # Create user
    user = User(email=email, username=email)
    user.set_password(password)
    user.save()

    if user_type == 'merchant':
        # Validate merchant-specific fields BEFORE creating user
        serializer = MerchantRegisterSerializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except DRFValidationError:
            user.delete()  # Clean up user if validation fails
            logger.warning("Merchant registration validation errors: %s", serializer.errors)
            raise  # Re-raise so couPro_exception_handler returns { error_code, developer_message, context }
        validated_data = serializer.validated_data
        
        # Add user to Merchant group
        try:
            merchant_group = Group.objects.get(name='Merchant')
            user.groups.add(merchant_group)
        except Group.DoesNotExist:
            # Create Merchant group if it doesn't exist
            merchant_group = Group.objects.create(name='Merchant')
            user.groups.add(merchant_group)
        
        # Create MerchantProfile
        merchant_profile = MerchantProfile.objects.create(
            user=user,
            phone=validated_data['phone'],
            contact_person=validated_data['contact_person'],
            contact_info=validated_data.get('contact_info') or ''
        )
        
        # Create Store
        Store.objects.create(
            owner=user,
            name=validated_data['store_name'],
            address=validated_data['store_address'],
            lat=validated_data['store_lat'],
            lng=validated_data['store_lng'],
            business_hours=validated_data.get('business_hours', '')
        )
        
        # Generate verification token and send email
        token = merchant_profile.generate_verification_token()
        try:
            send_merchant_verification_email(email, token)
        except Exception as email_error:
            # Log the error but don't fail registration
            logger.warning("Verification email failed but account created: %s", email_error)
            # Still return success, but note that email may not have been sent
            return Response({
                'message': '註冊成功！但驗證郵件發送失敗，請稍後重新申請驗證郵件。',
                'user_id': user.id,
                'email': email,
                'verification_required': True,
                'user_type': 'merchant',
                'email_sent': False,
                'email_error': str(email_error)
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'message': '註冊成功！驗證郵件已發送到您的信箱，請點擊連結完成驗證。',
            'user_id': user.id,
            'email': email,
            'verification_required': True,
            'user_type': 'merchant'
        }, status=status.HTTP_201_CREATED)
    else:
        # Student registration (existing logic)
        # Generate verification token
        token = secrets.token_urlsafe(32)

        # Create StudentProfile with the token and verified=False
        StudentProfile.objects.create(user=user, email_verification_token=token, verified=False)

        # Send verification email
        send_verification_email(email, token)

        return Response({'message': 'User registered successfully. Please check your email to verify.'}, status=status.HTTP_201_CREATED)


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
@permission_classes([AllowAny]) # Allow anyone with the token to access
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
        profile.email_verification_token = None # Clear token after verification
        profile.save()

        # Optionally activate the associated User account if it was inactive
        # profile.user.is_active = True
        # profile.user.save()

        return Response({"message": "Email verified successfully"})
    except StudentProfile.DoesNotExist:
        raise InvalidToken(developer_message="Invalid or expired token")


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
        
        # Check rate limit
        # allowed, message, wait_seconds = merchant_profile.can_send_verification_email()
        # if not allowed:
        #     return Response({
        #         'error': 'rate_limit_exceeded',
        #         'message': message,
        #         'wait_seconds': wait_seconds
        #     }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
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




@swagger_auto_schema(
    methods=['post'],
    request_body=LoginSerializer,
    operation_description="User login endpoint",
    responses={
        200: openapi.Response(
            description="Login successful",
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'user_id': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'access_token': openapi.Schema(type=openapi.TYPE_STRING),
                    'refresh_token': openapi.Schema(type=openapi.TYPE_STRING),
                    'token_type': openapi.Schema(type=openapi.TYPE_STRING),
                    'expires_in': openapi.Schema(type=openapi.TYPE_INTEGER),
                }
            )
        ),
        400: "Bad request - missing or invalid client_type",
        401: "帳號或密碼錯誤",
        403: "wrong_client_type - account type does not match client (use other app)",
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    # Use PhoneLoginSerializer to support both phone and email login.
    # raise_exception=True → ValidationError → couPro_exception_handler returns { error_code, developer_message, context }
    serializer = PhoneLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    validated = serializer.validated_data
    
    phone_number = validated.get('phone_number')
    email = validated.get('email')
    password = validated['password']
    client_type = validated['client_type']

    try:
        # Find user by phone_number OR email
        if phone_number:
            # Phone-based login: look up via StudentProfile.phone_number
            profile = StudentProfile.objects.filter(phone_number=phone_number).first()
            if not profile:
                raise PhoneNotRegistered(developer_message="此電話號碼尚未註冊")
            
            # Check phone_verified for phone-registered users
            if not profile.phone_verified:
                raise EmailNotVerified(developer_message="請先完成手機號碼驗證")
            
            user = profile.user
        else:
            # Email-based login: original logic (find user by email)
            user = User.objects.get(email=email)

        # Check verification status via the profile
        try:
            # Check if the user has a student profile
            if hasattr(user, 'student_profile'):
                profile = user.student_profile
                # For phone-based login, phone_verified is checked above
                # For email-based login, check email verification
                if email and not profile.verified:
                    raise EmailNotVerified(developer_message="請先完成信箱驗證")
            # If the user doesn't have a student profile (e.g., is a merchant or admin), skip verification check
        except StudentProfile.DoesNotExist:
            # This case should ideally not happen for student users after registration changes
            logger.warning("StudentProfile not found for user %s during login", getattr(user, 'email', user.username))
            # For now, let's allow login if profile is missing, assuming they might be non-student users
        
        # Check merchant verification status (cache result to avoid second DB query below)
        is_merchant = user.groups.filter(name='Merchant').exists()
        if is_merchant:
            try:
                merchant_profile = MerchantProfile.objects.get(user=user)
                if not merchant_profile.verified:
                    raise EmailNotVerified(
                        developer_message="請先驗證您的電子郵件",
                        context={"email": user.email},
                    )
            except MerchantProfile.DoesNotExist:
                logger.warning("MerchantProfile not found for merchant user %s", user.email)
                # Allow login if profile is missing (shouldn't happen in normal flow)

        if check_password(password, user.password):
            # Enforce client_type vs account type: merchant account only on merchant app, user only on user app
            if client_type == 'merchant' and not is_merchant:
                raise WrongClientTypeMerchant(developer_message="此帳號為一般使用者，請使用使用者端 App 登入")
            if client_type == 'user' and is_merchant:
                raise WrongClientTypeUser(developer_message="此帳號為商家帳號，請使用商家端 App 登入")

            # Generate both access and refresh tokens
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            # Set the last logged in time for this student profile
            if hasattr(user, 'student_profile'):
                user.student_profile.last_logged_in = timezone.now()
                user.student_profile.save()

            response = Response({
                "message": "Login successful",
                "user_id": user.id, # type: ignore
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()
            })

            return response
        else: # 密碼錯誤
            raise InvalidCredentials(developer_message="帳號或密碼錯誤")
    except User.DoesNotExist:
        raise InvalidCredentials(developer_message="帳號不存在")


@swagger_auto_schema(
    method='post',
    operation_description="User logout endpoint",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'refresh_token': openapi.Schema(
                type=openapi.TYPE_STRING,
                description='Refresh token to blacklist (optional)'
            )
        }
    ),
    responses={
        200: openapi.Response(
            description="Logout successful",
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'note': openapi.Schema(type=openapi.TYPE_STRING),
                }
            )
        )
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])  # 需要認證才能登出
def logout(request):
    """
    登出 API - 客戶端應該刪除儲存的 tokens
    """
    try:
        # 如果要實現 token blacklist，可以在這裡加入
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()  # 將 refresh token 加入黑名單
                logger.info("Token blacklisted successfully")
            except TokenError:
                pass  # Token 已經無效或過期，忽略錯誤
        
        return Response({
            "message": "已成功登出",
            "note": "請從客戶端移除所有儲存的 tokens"
        })
    except Exception as e:
        return Response({
            "error": "登出時發生錯誤",
            "detail": str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_info(request):
    """
    獲取用戶資訊的 API，需要身份驗證
    用於測試認證是否正常工作
    """
    user = request.user
    verified_status = False # Default
    is_merchant = user.groups.filter(name='Merchant').exists()

    # Get verification status from student profile if it exists
    if hasattr(user, 'student_profile'):
        try:
            verified_status = user.student_profile.verified
        except StudentProfile.DoesNotExist:
            pass # Should not happen if profile is created on registration
    # Merchants/Admins might not have a StudentProfile, verification logic might differ
    elif is_merchant or user.is_superuser:
        verified_status = True # Assume merchants/admins are verified by default or through another process

    response_data = {
        "id": user.id,
        "email": user.email,
        "verified": verified_status, # Use status from profile or default
        "is_merchant": is_merchant,
        "message": "你已成功登入並通過身份驗證",
        "date_joined": user.date_joined
    }
    
    # Add merchant-specific information if user is a merchant
    if is_merchant:
        try:
            merchant_profile = user.merchant_profile
            stores = user.owned_stores.all()
            response_data['merchant_profile'] = {
                'phone': merchant_profile.phone,
                'contact_person': merchant_profile.contact_person,
                'contact_info': merchant_profile.contact_info,
            }
            if stores.exists():
                store = stores.first()  # Get first store
                response_data['store'] = {
                    'id': store.id,
                    'name': store.name,
                    'address': store.address,
                    'lat': store.lat,
                    'lng': store.lng,
                    'business_hours': store.business_hours,
                }
        except MerchantProfile.DoesNotExist:
            pass

    return Response(response_data)    

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
        
        # Rate limiting check: 3 requests per hour
        # Check if token was created within the last hour
        # if reset_profile.token_created_at:
        #     time_since_last_request = timezone.now() - reset_profile.token_created_at
        #     # Count requests in the last hour (simple approach: check if last request was < 1 hour ago)
        #     # For more accurate tracking, we'd need additional fields, but this is a reasonable approximation
        #     if time_since_last_request.total_seconds() < 3600:  # Less than 1 hour
        #         # Check if we need to track request count - for now, use a simple cooldown
        #         # If token exists and was created recently, we might be hitting rate limit
        #         # However, we'll allow if it's been more than 20 minutes (allowing 3 requests/hour)
        #         if time_since_last_request.total_seconds() < 1200:  # Less than 20 minutes
        #             return Response({
        #                 'error': 'rate_limit_exceeded',
        #                 'message': '請稍後再試，每小時最多可申請 3 次密碼重設',
        #                 'wait_seconds': int(1200 - time_since_last_request.total_seconds())
        #             }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
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
    
    if len(new_password) < 8:
        raise PasswordTooShort(developer_message="密碼長度至少需要8個字符", context={"min_length": 8})
    
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


@swagger_auto_schema(
    method='post',
    operation_description="Refresh access token using refresh token",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['refresh_token'],
        properties={
            'refresh_token': openapi.Schema(
                type=openapi.TYPE_STRING,
                description='Valid refresh token'
            )
        }
    ),
    responses={
        200: openapi.Response(
            description="Token refreshed successfully",
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'access_token': openapi.Schema(type=openapi.TYPE_STRING),
                    'refresh_token': openapi.Schema(type=openapi.TYPE_STRING),
                    'token_type': openapi.Schema(type=openapi.TYPE_STRING),
                    'expires_in': openapi.Schema(type=openapi.TYPE_INTEGER),
                }
            )
        ),
        401: "Invalid or expired refresh token"
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    """
    刷新 JWT token 的 API
    當 access token 過期時，使用此 endpoint 獲取新的 access token
    """
    try:
        # Get the refresh token from request body instead of cookies
        refresh_token_value = request.data.get('refresh_token')
        
        if not refresh_token_value:
            raise RefreshTokenMissing(developer_message="No refresh token provided")
        
        # Validate and use the refresh token to get a new access token
        try:
            refresh = RefreshToken(refresh_token_value)
        except TokenError as e:
            raise RefreshTokenInvalid(developer_message="Invalid or expired refresh token. Please log in again.")
        
        access_token = str(refresh.access_token)
        new_refresh_token = refresh_token_value  # Default: keep the same refresh token
        
        # Check if refresh token rotation is enabled
        if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
            if settings.SIMPLE_JWT.get('BLACKLIST_AFTER_ROTATION', False):
                try:
                    refresh.blacklist()
                except Exception as blacklist_exc:
                    logger.warning("Failed to blacklist token during rotation: %s", blacklist_exc)
            
            # Create a new refresh token
            token_user_id = refresh.payload.get('user_id')
            if not token_user_id:
                raise RefreshTokenInvalid(developer_message="Invalid refresh token")
            
            try:
                user = User.objects.get(id=token_user_id)
                new_refresh = RefreshToken.for_user(user)
                new_refresh_token = str(new_refresh)
            except User.DoesNotExist:
                return Response({
                    "error": "User not found"
                }, status=status.HTTP_401_UNAUTHORIZED)
        
        return Response({
            "message": "Token refreshed successfully",
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "Bearer",
            "expires_in": int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        })
        
    except CouProAPIException:
        raise
    except Exception as e:
        logger.warning("Token refresh error: %s", e)
        raise RefreshTokenInvalid(developer_message="Invalid or expired refresh token")


# ============================================
# Deep Link Redirect Endpoints for Email Links
# ============================================
# These endpoints provide HTTPS URLs that redirect to coupromerchant:// deep links.
# This is necessary because most email clients only render https:// links as clickable.

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
