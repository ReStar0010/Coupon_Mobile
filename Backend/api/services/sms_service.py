"""
SMS Service for sending OTP codes via Twilio.
Supports development mode (console logging) and production mode (actual SMS).
"""
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class SMSService:
    """Twilio SMS service with development mode fallback."""

    def __init__(self):
        self.dev_mode = getattr(settings, 'SMS_DEV_MODE', True)
        if not self.dev_mode:
            from twilio.rest import Client
            self.client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN
            )
            self.from_number = settings.TWILIO_PHONE_NUMBER

    def send_otp(self, phone_number: str, otp_code: str) -> dict:
        """
        Send OTP via SMS.

        Args:
            phone_number: Taiwan mobile number in 09XXXXXXXX format
            otp_code: 6-digit verification code

        Returns:
            dict with keys:
            - success: bool
            - error: str|None
            - dev_mode: bool (only if dev mode)
            - otp_code: str (only if dev mode, for testing)
        """
        message = f"您的 CouPro 驗證碼是：{otp_code}，10分鐘內有效。請勿分享此驗證碼。"

        if self.dev_mode:
            logger.info(f"[DEV MODE] OTP for {phone_number}: {otp_code}")
            return {
                "success": True,
                "error": None,
                "dev_mode": True,
                "otp_code": otp_code
            }

        try:
            from twilio.base.exceptions import TwilioRestException

            # Convert Taiwan format 09... to E.164 format +8869...
            e164_number = f"+886{phone_number[1:]}"

            self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=e164_number
            )
            logger.info(f"SMS sent successfully to {phone_number}")
            return {"success": True, "error": None}
        except TwilioRestException as e:
            logger.error(f"Twilio error for {phone_number}: {e.code} - {e.msg}")
            return {"success": False, "error": str(e.msg)}
        except Exception as e:
            logger.error(f"Unexpected error sending SMS to {phone_number}: {str(e)}")
            return {"success": False, "error": "SMS發送失敗，請稍後再試"}
