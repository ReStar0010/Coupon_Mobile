from api.views.auth.register import register
from api.views.auth.login import login, logout, refresh_token
from api.views.auth.email_verification import (
    verify_email, request_email_verification,
    verify_merchant_email, resend_merchant_verification, redirect_verify_email
)
from api.views.auth.password_reset import forgot_password, reset_password, redirect_reset_password
from api.views.auth.user_info import user_info

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
]
