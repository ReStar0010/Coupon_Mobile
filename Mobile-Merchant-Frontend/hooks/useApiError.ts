import * as Sentry from '@sentry/react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { ApiError } from '@/utils/api';

/**
 * All error codes that are expected (i.e. caused by normal user actions).
 * These are NOT reported to Sentry.
 * Any code outside this set, or any 5xx, is treated as unexpected and IS reported.
 */
const EXPECTED_ERROR_CODES = new Set<string>([
  // Authentication
  'USER_NOT_FOUND',
  'EMAIL_ALREADY_EXISTS',
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'WRONG_CLIENT_TYPE_MERCHANT',
  'WRONG_CLIENT_TYPE_USER',
  'NOT_AUTHENTICATED',
  'AUTHENTICATION_FAILED',
  'PERMISSION_DENIED',
  'REFRESH_TOKEN_MISSING',
  'REFRESH_TOKEN_INVALID',
  // Email verification
  'MISSING_TOKEN',
  'INVALID_TOKEN',
  'EXPIRED_TOKEN',
  'ALREADY_VERIFIED',
  // Password
  'PASSWORD_TOO_SHORT',
  'INVALID_RESET_LINK',
  'EXPIRED_RESET_LINK',
  'INVALID_PASSWORD',
  // OTP
  'OTP_NOT_FOUND',
  'OTP_EXPIRED',
  'OTP_MAX_ATTEMPTS',
  'OTP_INVALID',
  'OTP_RATE_LIMITED',
  'PHONE_ALREADY_REGISTERED',
  'PHONE_NOT_REGISTERED',
  'PHONE_ALREADY_USED_BY_OTHER',
  // Merchant
  'NOT_A_MERCHANT',
  'MERCHANT_PROFILE_NOT_FOUND',
  'NO_STORE_FOR_MERCHANT',
  'MERCHANT_APPLICATION_PENDING',
  'MERCHANT_APPLICATION_REJECTED',
  // EULA
  'EULA_NOT_ACCEPTED',
  'EULA_ALREADY_ACCEPTED',
  'EULA_VERSION_MISMATCH',
  // Coupon templates
  'COUPON_TEMPLATE_NOT_FOUND',
  'COUPON_TEMPLATE_EXPIRED',
  'COUPON_TEMPLATE_OUT_OF_STOCK',
  'TEMPLATE_QUANTITY_DECREASE_NOT_ALLOWED',
  'COUPON_ALREADY_REDEEMED',
  'COUPON_NOT_HOLDER',
  'REDEEM_CODE_INVALID',
  'UNIFIED_CODE_INVALID',
  // QR
  'QR_SESSION_EXPIRED',
  'QR_SESSION_NOT_FOUND',
  'QR_SESSION_UNAUTHORIZED',
  // Image upload (413/500 are expected user/server errors)
  'IMAGE_TYPE_INVALID',
  'IMAGE_TOO_LARGE',
  'IMAGE_UPLOAD_FAILED',
  'IMAGE_DELETE_FAILED',
  // Analytics
  'INVALID_DATE_FORMAT',
  'INVALID_DATE_RANGE',
  'DATE_RANGE_FUTURE',
  'DATE_RANGE_TOO_LONG',
  // Content moderation
  'INVALID_CONTENT_TYPE',
  'CONTENT_NOT_FOUND',
  'SELF_REPORT_NOT_ALLOWED',
  'REPORT_DUPLICATE',
  'ALREADY_BLOCKED',
  // Account
  'DELETE_ACKNOWLEDGMENT_REQUIRED',
  'MERCHANT_ONLY_FEATURE',
  // Field validation
  'VALIDATION_ERROR',
  'FIELD_BLANK',
  'FIELD_REQUIRED',
  'FIELD_TOO_LONG',
  'FIELD_INVALID',
  'FIELD_NOT_UNIQUE',
  'PHONE_FORMAT_INVALID',
  'OTP_CODE_FORMAT_INVALID',
  // Network / infrastructure
  'RATE_LIMITED',
  'METHOD_NOT_ALLOWED',
  'NOT_FOUND',
  // Sharing
  'SHARE_REQUEST_NOT_FOUND',
  'SHARE_ALREADY_PUBLIC',
  'SHARE_FAILED',
  'SELF_CLAIM_NOT_ALLOWED',
  'SHARE_REQUEST_ALREADY_PROCESSED',
  'SHARE_ALREADY_CLAIMED',
  'SHARE_NOT_PENDING_FOR_WITHDRAW',
]);

/**
 * Hook that converts a caught API error into a localised zh-TW string.
 *
 * Responsibilities:
 *  1. Map error_code → t('errors.CODE', context) for interpolation
 *  2. Report unexpected errors (5xx or unknown error_code) to Sentry
 *  3. Fallback to GENERIC_ERROR when no translation key is found
 *
 * Usage:
 *   const { getErrorMessage } = useApiError();
 *   // inside catch:
 *   setErrorMsg(getErrorMessage(error));
 */
export function useApiError() {
  const { t } = useTranslation();

  const getErrorMessage = useCallback(
    (error: unknown): string => {
      const apiError = error as ApiError;
      const code = apiError.errorCode ?? 'GENERIC_ERROR';
      const ctx = apiError.context ?? {};
      const statusCode = apiError.statusCode ?? 0;

      // Report unexpected errors to Sentry
      const isUnexpected = statusCode >= 500 || !EXPECTED_ERROR_CODES.has(code);
      if (isUnexpected) {
        Sentry.captureException(error);
      }

      return t(`errors.${code}`, {
        ...ctx,
        defaultValue: t('errors.GENERIC_ERROR'),
      });
    },
    [t],
  );

  return { getErrorMessage };
}
