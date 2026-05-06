"""
Email helper functions for authentication-related emails.
Delegates to api.services.email_service — the single source of truth for email sending.
"""
from api.services.email_service import (
    send_verification_email,
    send_merchant_verification_email,
    send_password_reset_email as _svc_send_password_reset_email,
    send_merchant_approval_email as send_merchant_application_approved_email,
    send_merchant_rejection_email as send_merchant_application_rejected_email,
)


def send_password_reset_email(user_email: str, token: str, user_type: str = 'student') -> bool:
    """Thin wrapper — translates user_type string to is_merchant bool for the service."""
    return _svc_send_password_reset_email(
        user_email=user_email,
        token=token,
        is_merchant=(user_type == 'merchant'),
    )


__all__ = [
    'send_verification_email',
    'send_merchant_verification_email',
    'send_password_reset_email',
    'send_merchant_application_approved_email',
    'send_merchant_application_rejected_email',
]
