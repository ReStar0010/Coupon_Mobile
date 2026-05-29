# Thin re-export shim — real implementations moved to api/views/auth/
from api.views.auth.register import register
from api.views.auth.login import login, logout, refresh_token
from api.views.auth.email_verification import (
    verify_email, request_email_verification,
    verify_merchant_email, resend_merchant_verification, redirect_verify_email
)
from api.views.auth.password_reset import forgot_password, reset_password, redirect_reset_password
from api.views.auth.user_info import user_info

# Email helpers re-exported for use by other modules (e.g. admin_moderation)
from api.views.auth.email_helpers import (
    send_verification_email,
    send_merchant_verification_email,
    send_merchant_application_approved_email,
    send_merchant_application_rejected_email,
    send_password_reset_email,
)

__all__ = [
    'register',
    'login',
    'logout',
    'refresh_token',
    'verify_email',
    'request_email_verification',
    'verify_merchant_email',
    'resend_merchant_verification',
    'redirect_verify_email',
    'forgot_password',
    'reset_password',
    'redirect_reset_password',
    'user_info',
    'send_verification_email',
    'send_merchant_verification_email',
    'send_merchant_application_approved_email',
    'send_merchant_application_rejected_email',
    'send_password_reset_email',
]
