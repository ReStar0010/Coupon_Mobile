"""Email sending service — wraps Resend API calls."""
import logging
from urllib.parse import urlencode

import resend
from django.conf import settings

logger = logging.getLogger(__name__)

FROM_EMAIL = "noreply@coupro.pro"


def _init_resend() -> None:
    """Ensure the Resend API key is set before any call."""
    resend.api_key = settings.RESEND_API_KEY


def send_verification_email(user_email: str, token: str) -> bool:
    """
    Send email verification link to a student user.

    Args:
        user_email: Recipient email address.
        token: Verification token.

    Returns:
        True on success, False on failure.
    """
    _init_resend()
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
            letter-spacing: 0.5px;
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
        .logo {{
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
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

    try:
        params = {
            "from": FROM_EMAIL,
            "to": user_email,
            "subject": subject,
            "html": html_message,
        }
        email = resend.Emails.send(params)
        logger.debug("Resend API response for student verification: %s", email)
        logger.info("Successfully sent verification email to %s", user_email)
        return True
    except Exception as e:
        logger.error("Failed to send verification email to %s: %s", user_email, e)
        return False


def send_merchant_verification_email(merchant_email: str, token: str, merchant_name: str = "") -> bool:
    """
    Send merchant email verification link.

    Args:
        merchant_email: Recipient email address.
        token: Verification token.
        merchant_name: Optional merchant display name (unused in current template).

    Returns:
        True on success. Raises Exception with a user-friendly message on failure.
    """
    _init_resend()
    api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro')
    verification_link = (
        f"{api_base_url}/api/merchant/redirect/verify-email?"
        f"{urlencode({'token': token, 'email': merchant_email})}"
    )

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
            letter-spacing: 0.5px;
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
        .logo {{
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
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

    try:
        params = {
            "from": FROM_EMAIL,
            "to": merchant_email,
            "subject": subject,
            "html": html_message,
        }
        email = resend.Emails.send(params)
        logger.debug("Resend API response for merchant verification: %s", email)
        logger.info("Successfully sent merchant verification email to %s", merchant_email)
        return True
    except Exception as e:
        error_message = str(e)
        logger.error("Failed to send merchant verification email to %s: %s", merchant_email, error_message)
        if 'rate_limit' in error_message.lower() or '429' in error_message:
            raise Exception('郵件服務暫時無法使用，請稍後再試')
        elif 'invalid' in error_message.lower() or 'unauthorized' in error_message.lower():
            raise Exception('郵件服務配置錯誤，請聯繫管理員')
        elif 'network' in error_message.lower() or 'timeout' in error_message.lower():
            raise Exception('網路連線問題，請稍後再試')
        else:
            raise Exception('發送郵件時發生錯誤，請稍後再試或聯繫客服')


def send_password_reset_email(user_email: str, token: str, is_merchant: bool = False) -> bool:
    """
    Send password reset link.

    Args:
        user_email: Recipient email address.
        token: Password reset token.
        is_merchant: If True, generates a merchant deep-link redirect URL.

    Returns:
        True on success. Raises Exception with a user-friendly message on failure.
    """
    _init_resend()
    if is_merchant:
        api_base_url = getattr(settings, 'API_BASE_URL', 'https://api.coupro.pro')
        reset_link = (
            f"{api_base_url}/api/merchant/redirect/reset-password?"
            f"{urlencode({'token': token, 'email': user_email})}"
        )
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
            letter-spacing: 0.5px;
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
        .logo {{
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
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

    try:
        params = {
            "from": FROM_EMAIL,
            "to": user_email,
            "subject": subject,
            "html": html_message,
        }
        email = resend.Emails.send(params)
        logger.debug("Resend API response for password reset: %s", email)
        logger.info("Successfully sent password reset email to %s", user_email)
        return True
    except Exception as e:
        error_message = str(e)
        logger.error("Failed to send password reset email to %s: %s", user_email, error_message)
        if 'rate_limit' in error_message.lower() or '429' in error_message:
            raise Exception('郵件服務暫時無法使用，請稍後再試')
        elif 'invalid' in error_message.lower() or 'unauthorized' in error_message.lower():
            raise Exception('郵件服務配置錯誤，請聯繫管理員')
        elif 'network' in error_message.lower() or 'timeout' in error_message.lower():
            raise Exception('網路連線問題，請稍後再試')
        else:
            raise Exception('發送郵件時發生錯誤，請稍後再試或聯繫客服')


def send_merchant_approval_email(merchant_email: str) -> bool:
    """
    Send merchant application approved notification.

    Args:
        merchant_email: Recipient email address.

    Returns:
        True on success, False on failure.
    """
    _init_resend()
    subject = '您的 CouPro 商家申請已通過'
    html_message = '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>CouPro 商家申請已通過</title>
</head>
<body>
    <p>親愛的商家夥伴，您好！</p>
    <p>您的 CouPro 商家申請已通過審核。</p>
    <p>若您尚未完成電子郵件驗證，請先完成驗證；完成後即可登入商家端 App 使用平台功能。</p>
    <p>CouPro 團隊</p>
</body>
</html>
'''
    try:
        params = {
            "from": FROM_EMAIL,
            "to": merchant_email,
            "subject": subject,
            "html": html_message,
        }
        resend.Emails.send(params)
        logger.info("Sent merchant approval email to %s", merchant_email)
        return True
    except Exception as e:
        logger.error("Failed to send merchant approval email to %s: %s", merchant_email, e)
        return False


def send_merchant_rejection_email(merchant_email: str, reason: str = "") -> bool:
    """
    Send merchant application rejected notification.

    Args:
        merchant_email: Recipient email address.
        reason: Optional rejection reason (currently unused in the HTML body).

    Returns:
        True on success, False on failure.
    """
    _init_resend()
    subject = '您的 CouPro 商家申請未通過'
    html_message = '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>CouPro 商家申請未通過</title>
</head>
<body>
    <p>親愛的商家夥伴，您好！</p>
    <p>很抱歉，您的 CouPro 商家申請目前未通過審核。</p>
    <p>若您需要進一步協助，請聯繫 CouPro 團隊。</p>
    <p>CouPro 團隊</p>
</body>
</html>
'''
    try:
        params = {
            "from": FROM_EMAIL,
            "to": merchant_email,
            "subject": subject,
            "html": html_message,
        }
        resend.Emails.send(params)
        logger.info("Sent merchant rejection email to %s", merchant_email)
        return True
    except Exception as e:
        logger.error("Failed to send merchant rejection email to %s: %s", merchant_email, e)
        return False
