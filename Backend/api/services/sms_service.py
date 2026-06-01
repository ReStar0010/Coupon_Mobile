"""
SMS Service for sending OTP codes via Twilio.
Supports development mode (console logging) and production mode (actual SMS).
"""
import time

from django.conf import settings
import logging

logger = logging.getLogger(__name__)

# Hard cap on how long we will wait for Twilio to *accept* the message request.
# Twilio normally accepts in ~75-150ms (p50/p99); without a timeout the helper
# can hang indefinitely when Twilio or a carrier route is degraded, tying up a
# server worker and leaving the user on a spinner. 5s is well above the normal
# acceptance time but bounds the worst case. NOTE: this bounds API *acceptance*,
# not carrier *delivery* — delivery latency is carrier-side and invisible here.
SMS_HTTP_TIMEOUT_SECONDS = 5

# Log a warning when acceptance takes longer than this — a signal that the slow
# part is Twilio's platform (not your code, and not — separately — carrier
# delivery). Helps decide whether a deeper async/Verify refactor is justified.
SMS_SLOW_ACCEPT_WARN_SECONDS = 1.5


class SMSService:
    """Twilio SMS service with development mode fallback."""

    def __init__(self):
        self.dev_mode = getattr(settings, 'SMS_DEV_MODE', True)
        if not self.dev_mode:
            from twilio.rest import Client
            from twilio.http.http_client import TwilioHttpClient

            # Explicit timeout: the default Twilio HTTP client has no timeout and
            # can block the request thread forever if Twilio doesn't respond.
            http_client = TwilioHttpClient(timeout=SMS_HTTP_TIMEOUT_SECONDS)
            self.client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
                http_client=http_client,
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
            from requests.exceptions import Timeout as RequestsTimeout

            # Convert Taiwan format 09... to E.164 format +8869...
            e164_number = f"+886{phone_number[1:]}"

            started = time.perf_counter()
            try:
                msg = self.client.messages.create(
                    body=message,
                    from_=self.from_number,
                    to=e164_number,
                )
            except RequestsTimeout:
                elapsed = time.perf_counter() - started
                logger.error(
                    "Twilio API acceptance timed out for %s after %.2fs "
                    "(limit %ss) — Twilio/route degraded, not message content.",
                    phone_number, elapsed, SMS_HTTP_TIMEOUT_SECONDS,
                )
                return {"success": False, "error": "SMS發送失敗，請稍後再試"}

            elapsed = time.perf_counter() - started
            # Phase 2 instrumentation: wall-clock time for Twilio to *accept* the
            # request. If this is fast but users still report slow OTPs, the delay
            # is carrier-side delivery (e.g. Chunghwa / FarEasTone in Taiwan), which
            # no backend change can fix.
            log = logger.warning if elapsed >= SMS_SLOW_ACCEPT_WARN_SECONDS else logger.info
            log(
                "SMS accepted by Twilio for %s in %.3fs (sid=%s status=%s)",
                phone_number, elapsed, getattr(msg, "sid", "?"),
                getattr(msg, "status", "?"),
            )
            return {"success": True, "error": None}
        except TwilioRestException as e:
            logger.error(f"Twilio error for {phone_number}: {e.code} - {e.msg}")
            return {"success": False, "error": str(e.msg)}
        except Exception as e:
            logger.error(f"Unexpected error sending SMS to {phone_number}: {str(e)}")
            return {"success": False, "error": "SMS發送失敗，請稍後再試"}
