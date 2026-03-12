"""
CouPro unified API exception contract.

Every error raised via these classes produces a consistent JSON body:
    {
        "error_code":        "SOME_CONSTANT",
        "developer_message": "English technical explanation",
        "error":             "English technical explanation",  # same as developer_message, for backward compatibility
        "context":           {"field": "email", "limit": 20}   # optional
    }

Usage in views:
    from api.exceptions import EmailAlreadyExists
    raise EmailAlreadyExists(developer_message="User tried to register with existing email")

Phase-1 scope: new code uses these exceptions.
Phase-2 (future): migrate inline `return Response({'error': ...})` to raise calls.
"""

from __future__ import annotations

import sentry_sdk
from rest_framework import exceptions as drf_exc
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError as DRFValidationError
from rest_framework.views import exception_handler


# ---------------------------------------------------------------------------
# Base exception
# ---------------------------------------------------------------------------

class CouProAPIException(APIException):
    """Base class for all CouPro domain exceptions."""

    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "GENERIC_ERROR"

    def __init__(
        self,
        developer_message: str = "",
        context: dict | None = None,
        **kwargs,
    ):
        self.developer_message = developer_message
        self.context = context or {}
        super().__init__(**kwargs)


# ---------------------------------------------------------------------------
# Authentication / Account
# ---------------------------------------------------------------------------

class UserNotFound(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "USER_NOT_FOUND"


class EmailAlreadyExists(CouProAPIException):
    status_code = status.HTTP_409_CONFLICT
    error_code = "EMAIL_ALREADY_EXISTS"


class InvalidCredentials(CouProAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "INVALID_CREDENTIALS"


class EmailNotVerified(CouProAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "EMAIL_NOT_VERIFIED"


class MerchantApplicationPending(CouProAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "MERCHANT_APPLICATION_PENDING"


class MerchantApplicationRejected(CouProAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "MERCHANT_APPLICATION_REJECTED"


class WrongClientTypeMerchant(CouProAPIException):
    """Consumer account trying to use merchant app."""
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "WRONG_CLIENT_TYPE_MERCHANT"


class WrongClientTypeUser(CouProAPIException):
    """Merchant account trying to use consumer app."""
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "WRONG_CLIENT_TYPE_USER"


# ---------------------------------------------------------------------------
# Email verification tokens
# ---------------------------------------------------------------------------

class MissingToken(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "MISSING_TOKEN"


class InvalidToken(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INVALID_TOKEN"


class AlreadyVerified(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "ALREADY_VERIFIED"


class ExpiredToken(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "EXPIRED_TOKEN"


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

class PasswordTooShort(CouProAPIException):
    """context: {"min_length": 8}"""
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "PASSWORD_TOO_SHORT"


class InvalidResetLink(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INVALID_RESET_LINK"


class ExpiredResetLink(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "EXPIRED_RESET_LINK"


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

class RefreshTokenMissing(CouProAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "REFRESH_TOKEN_MISSING"


class RefreshTokenInvalid(CouProAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "REFRESH_TOKEN_INVALID"


# ---------------------------------------------------------------------------
# OTP
# ---------------------------------------------------------------------------

class OTPNotFound(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "OTP_NOT_FOUND"


class OTPExpired(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "OTP_EXPIRED"


class OTPMaxAttempts(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "OTP_MAX_ATTEMPTS"


class OTPInvalid(CouProAPIException):
    """context: {"attempts_remaining": 3}"""
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "OTP_INVALID"


class OTPRateLimited(CouProAPIException):
    """context: {"retry_after_seconds": 60}"""
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    error_code = "OTP_RATE_LIMITED"


class SmsSendFailed(CouProAPIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = "SMS_SEND_FAILED"


class PhoneAlreadyRegistered(CouProAPIException):
    status_code = status.HTTP_409_CONFLICT
    error_code = "PHONE_ALREADY_REGISTERED"


class PhoneNotRegistered(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "PHONE_NOT_REGISTERED"


class PhoneAlreadyUsedByOther(CouProAPIException):
    status_code = status.HTTP_409_CONFLICT
    error_code = "PHONE_ALREADY_USED_BY_OTHER"


class PhoneFormatInvalid(CouProAPIException):
    """context: optional {"field": "phone_number"}"""
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "PHONE_FORMAT_INVALID"


# ---------------------------------------------------------------------------
# Merchant / Store
# ---------------------------------------------------------------------------

class NotAMerchant(CouProAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "NOT_A_MERCHANT"


class MerchantProfileNotFound(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "MERCHANT_PROFILE_NOT_FOUND"


class NoStoreForMerchant(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "NO_STORE_FOR_MERCHANT"


# ---------------------------------------------------------------------------
# EULA
# ---------------------------------------------------------------------------

class EulaNotAccepted(CouProAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "EULA_NOT_ACCEPTED"


class EulaAlreadyAccepted(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "EULA_ALREADY_ACCEPTED"


class EulaVersionMismatch(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "EULA_VERSION_MISMATCH"


# ---------------------------------------------------------------------------
# Coupon templates
# ---------------------------------------------------------------------------

class CouponTemplateNotFound(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "COUPON_TEMPLATE_NOT_FOUND"


class CouponTemplateExpired(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "COUPON_TEMPLATE_EXPIRED"


class CouponTemplateOutOfStock(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "COUPON_TEMPLATE_OUT_OF_STOCK"


class TemplateQuantityDecreaseNotAllowed(CouProAPIException):
    """context: {"current": 50}"""
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "TEMPLATE_QUANTITY_DECREASE_NOT_ALLOWED"


# ---------------------------------------------------------------------------
# Coupon redemption
# ---------------------------------------------------------------------------

class CouponAlreadyRedeemed(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "COUPON_ALREADY_REDEEMED"


class CouponNotHolder(CouProAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "COUPON_NOT_HOLDER"


class RedeemCodeInvalid(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "REDEEM_CODE_INVALID"


class UnifiedCodeInvalid(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "UNIFIED_CODE_INVALID"


# ---------------------------------------------------------------------------
# Sharing / Share requests
# ---------------------------------------------------------------------------

class ShareRequestNotFound(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "SHARE_REQUEST_NOT_FOUND"


class ShareAlreadyPublic(CouProAPIException):
    """Coupon is already shared to the public pool."""
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "SHARE_ALREADY_PUBLIC"


class ShareFailed(CouProAPIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = "SHARE_FAILED"


class SelfClaimNotAllowed(CouProAPIException):
    """User cannot claim their own shared coupon."""
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "SELF_CLAIM_NOT_ALLOWED"


class ShareRequestAlreadyProcessed(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "SHARE_REQUEST_ALREADY_PROCESSED"


class ShareAlreadyClaimed(CouProAPIException):
    """Public share coupon was already claimed by someone else."""
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "SHARE_ALREADY_CLAIMED"


class ShareNotPendingForWithdraw(CouProAPIException):
    """Only pending public shares can be withdrawn."""
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "SHARE_NOT_PENDING_FOR_WITHDRAW"


# ---------------------------------------------------------------------------
# QR Code sessions
# ---------------------------------------------------------------------------

class QRSessionExpired(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "QR_SESSION_EXPIRED"


class QRSessionNotFound(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "QR_SESSION_NOT_FOUND"


class QRSessionUnauthorized(CouProAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "QR_SESSION_UNAUTHORIZED"


# ---------------------------------------------------------------------------
# Image upload
# ---------------------------------------------------------------------------

class ImageTypeInvalid(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "IMAGE_TYPE_INVALID"


class ImageTooLarge(CouProAPIException):
    """context: {"max_mb": 5}"""
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    error_code = "IMAGE_TOO_LARGE"


class ImageUploadFailed(CouProAPIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = "IMAGE_UPLOAD_FAILED"


class ImageDeleteFailed(CouProAPIException):
    """Raised when deleting an image file from storage fails (e.g. during template delete)."""
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = "IMAGE_DELETE_FAILED"


# ---------------------------------------------------------------------------
# Analytics / date ranges
# ---------------------------------------------------------------------------

class InvalidDateFormat(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INVALID_DATE_FORMAT"


class InvalidDateRange(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INVALID_DATE_RANGE"


class DateRangeFuture(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "DATE_RANGE_FUTURE"


class DateRangeTooLong(CouProAPIException):
    """context: {"max_days": 730}"""
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "DATE_RANGE_TOO_LONG"


# ---------------------------------------------------------------------------
# Content moderation / reporting
# ---------------------------------------------------------------------------

class InvalidContentType(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INVALID_CONTENT_TYPE"


class ContentNotFound(CouProAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "CONTENT_NOT_FOUND"


class SelfReportNotAllowed(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "SELF_REPORT_NOT_ALLOWED"


class ReportDuplicate(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "REPORT_DUPLICATE"


class AlreadyBlocked(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "ALREADY_BLOCKED"


# ---------------------------------------------------------------------------
# Account deletion
# ---------------------------------------------------------------------------

class InvalidPassword(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INVALID_PASSWORD"


class DeleteAcknowledgmentRequired(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "DELETE_ACKNOWLEDGMENT_REQUIRED"


class MerchantOnlyFeature(CouProAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "MERCHANT_ONLY_FEATURE"


# ---------------------------------------------------------------------------
# Email delivery
# ---------------------------------------------------------------------------

class EmailSendFailed(CouProAPIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = "EMAIL_SEND_FAILED"


# ---------------------------------------------------------------------------
# Serializer validation helpers
# ---------------------------------------------------------------------------

# Maps DRF ErrorDetail.code → our error_code constant
_SERIALIZER_CODE_MAP: dict[str, str] = {
    "blank":      "FIELD_BLANK",
    "required":   "FIELD_REQUIRED",
    "max_length": "FIELD_TOO_LONG",
    "invalid":    "FIELD_INVALID",
    "unique":     "FIELD_NOT_UNIQUE",
    "null":       "FIELD_REQUIRED",
}

# Maps native DRF exception type → our error_code constant
_DRF_EXCEPTION_MAP: dict[type, str] = {
    drf_exc.AuthenticationFailed: "AUTHENTICATION_FAILED",
    drf_exc.NotAuthenticated:     "NOT_AUTHENTICATED",
    drf_exc.PermissionDenied:     "PERMISSION_DENIED",
    drf_exc.NotFound:             "NOT_FOUND",
    drf_exc.MethodNotAllowed:     "METHOD_NOT_ALLOWED",
    drf_exc.Throttled:            "RATE_LIMITED",
    drf_exc.UnsupportedMediaType: "UNSUPPORTED_MEDIA_TYPE",
}


def _extract_serializer_error(exc: DRFValidationError) -> dict:
    """
    Parse a DRF ValidationError into our standardised error dict.
    Reads the first field error and maps ErrorDetail.code → error_code.
    """
    detail = exc.detail

    if isinstance(detail, dict):
        # Field-level errors: {"email": [ErrorDetail(...)]}
        field, errors = next(iter(detail.items()))
        first_error = errors[0] if isinstance(errors, list) else errors
    elif isinstance(detail, list):
        # Non-field errors: [ErrorDetail(...)]
        field = "non_field_errors"
        first_error = detail[0]
    else:
        msg = str(detail)
        return {
            "error_code": "VALIDATION_ERROR",
            "developer_message": msg,
            "error": msg,
            "context": {},
        }

    code = getattr(first_error, "code", "invalid")
    error_code = _SERIALIZER_CODE_MAP.get(code, "VALIDATION_ERROR")
    ctx: dict = {"field": field}
    msg = str(first_error)
    return {
        "error_code": error_code,
        "developer_message": msg,
        "error": msg,
        "context": ctx,
    }


def _map_drf_exception(exc: APIException) -> str:
    return _DRF_EXCEPTION_MAP.get(type(exc), "GENERIC_ERROR")


# ---------------------------------------------------------------------------
# Global DRF exception handler
# ---------------------------------------------------------------------------

def couPro_exception_handler(exc: Exception, context: dict):
    """
    Drop-in replacement for DRF's default exception_handler.
    Register in settings.py:
        REST_FRAMEWORK = {
            'EXCEPTION_HANDLER': 'api.exceptions.couPro_exception_handler',
        }

    All responses follow the shape:
        {"error_code": str, "developer_message": str, "error": str, "context": dict}
    """
    response = exception_handler(exc, context)

    if response is None:
        # DRF could not handle this — truly unexpected server error
        sentry_sdk.capture_exception(exc)
        return None

    if isinstance(exc, CouProAPIException):
        msg = exc.developer_message
        response.data = {
            "error_code": exc.error_code,
            "developer_message": msg,
            "error": msg,
            "context": exc.context,
        }
    elif isinstance(exc, DRFValidationError):
        # Serializer validation failure — parse field-level ErrorDetail
        response.data = _extract_serializer_error(exc)
    else:
        # Native DRF exceptions (AuthenticationFailed, PermissionDenied, etc.)
        msg = str(exc.detail) if hasattr(exc, "detail") else str(exc)
        response.data = {
            "error_code": _map_drf_exception(exc),
            "developer_message": msg,
            "error": msg,
            "context": {},
        }

    # Only report unexpected server errors to Sentry (4xx are expected user errors)
    if response.status_code >= 500:
        sentry_sdk.capture_exception(exc)

    return response
