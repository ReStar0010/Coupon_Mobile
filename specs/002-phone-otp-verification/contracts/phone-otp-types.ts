/**
 * TypeScript interfaces for Phone OTP Verification API
 * Feature: 002-phone-otp-verification
 *
 * These interfaces match the OpenAPI spec in phone-otp-api.yaml
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request body for POST /api/phone-otp/send/
 */
export interface SendOTPRequest {
  /** Taiwan mobile number (09XXXXXXXX format) */
  phone_number: string;
}

/**
 * Request body for POST /api/phone-otp/verify/
 */
export interface VerifyOTPRequest {
  /** Phone number that received the OTP */
  phone_number: string;
  /** 6-digit verification code */
  otp_code: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response from POST /api/phone-otp/send/
 */
export interface SendOTPResponse {
  /** Success message with masked phone */
  message: string;
  /** Seconds until resend is allowed */
  cooldown_seconds: number;
  /** Seconds until OTP expires */
  expires_in_seconds: number;
  /** True if running in development mode (OTP not actually sent) */
  dev_mode?: boolean;
  /** OTP code (only in dev mode for testing) */
  otp_code?: string;
}

/**
 * Response from POST /api/phone-otp/verify/
 */
export interface VerifyOTPResponse {
  /** Success message */
  message: string;
  /** Verified phone number */
  phone_number: string;
  /** Masked phone for display */
  masked_phone: string;
  /** Number of pending coupons claimed for this phone */
  pending_coupons_claimed: number;
  /** Number of unclaimed coupons transferred from old phone (only when changing phone) */
  old_phone_coupons_transferred?: number;
}

/**
 * Response from GET /api/user/phone/
 */
export interface GetPhoneResponse {
  /** Raw phone number or null if not set */
  phone_number: string | null;
  /** Masked phone for display or null if not set */
  masked_phone: string | null;
}

/**
 * Error response structure (all endpoints)
 */
export interface ErrorResponse {
  /** Error message in Chinese */
  error: string;
  /** Suggested endpoint to use instead */
  redirect?: string;
  /** Seconds to wait before retrying (for rate limits) */
  retry_after_seconds?: number;
  /** Remaining verification attempts (for OTP errors) */
  attempts_remaining?: number;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates Taiwan mobile phone number format
 * @param phone Phone number to validate
 * @returns true if valid 09XXXXXXXX format
 */
export function isValidPhoneNumber(phone: string): boolean {
  return /^09\d{8}$/.test(phone.replace(/[-\s]/g, ''));
}

/**
 * Validates 6-digit OTP code format
 * @param code OTP code to validate
 * @returns true if valid 6-digit format
 */
export function isValidOTPCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Normalizes phone number by removing formatting
 * @param phone Phone number with possible formatting
 * @returns Normalized 09XXXXXXXX format
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[-\s()]/g, '');
}

/**
 * Masks phone number for display
 * @param phone Full phone number
 * @returns Masked format: 0912****78
 */
export function maskPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length !== 10) return phone;
  return `${normalized.slice(0, 4)}****${normalized.slice(-2)}`;
}

// ============================================================================
// API Error Handling
// ============================================================================

/**
 * Error codes for phone OTP operations
 */
export enum PhoneOTPErrorCode {
  /** Phone format invalid */
  INVALID_FORMAT = 'INVALID_FORMAT',
  /** Phone already registered to another user */
  PHONE_TAKEN = 'PHONE_TAKEN',
  /** Hourly rate limit exceeded */
  RATE_LIMIT_HOURLY = 'RATE_LIMIT_HOURLY',
  /** 60-second cooldown active */
  RATE_LIMIT_COOLDOWN = 'RATE_LIMIT_COOLDOWN',
  /** OTP code incorrect */
  INVALID_OTP = 'INVALID_OTP',
  /** OTP has expired */
  OTP_EXPIRED = 'OTP_EXPIRED',
  /** Max verification attempts reached */
  MAX_ATTEMPTS = 'MAX_ATTEMPTS',
  /** No pending OTP found */
  NO_PENDING_OTP = 'NO_PENDING_OTP',
  /** SMS delivery failed */
  SMS_FAILED = 'SMS_FAILED',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Maps Chinese error messages to error codes
 * @param errorMessage Chinese error message from API
 * @returns Corresponding error code
 */
export function getErrorCode(errorMessage: string): PhoneOTPErrorCode {
  const errorMap: Record<string, PhoneOTPErrorCode> = {
    '請輸入有效的台灣手機號碼': PhoneOTPErrorCode.INVALID_FORMAT,
    '此電話號碼已被其他帳號使用': PhoneOTPErrorCode.PHONE_TAKEN,
    '已超過每小時OTP請求次數限制': PhoneOTPErrorCode.RATE_LIMIT_HOURLY,
    '請等待60秒後再重新發送驗證碼': PhoneOTPErrorCode.RATE_LIMIT_COOLDOWN,
    '驗證碼錯誤': PhoneOTPErrorCode.INVALID_OTP,
    '驗證碼已過期': PhoneOTPErrorCode.OTP_EXPIRED,
    '驗證碼輸入錯誤次數過多': PhoneOTPErrorCode.MAX_ATTEMPTS,
    '找不到待驗證的OTP': PhoneOTPErrorCode.NO_PENDING_OTP,
    'SMS could not be sent': PhoneOTPErrorCode.SMS_FAILED,
  };

  for (const [message, code] of Object.entries(errorMap)) {
    if (errorMessage.includes(message)) {
      return code;
    }
  }

  return PhoneOTPErrorCode.UNKNOWN;
}

// ============================================================================
// State Types (for frontend components)
// ============================================================================

/**
 * OTP verification flow state
 */
export type OTPFlowState =
  | 'idle'           // Initial state, showing phone input
  | 'sending'        // Sending OTP request
  | 'sent'           // OTP sent, showing code input
  | 'verifying'      // Verifying OTP code
  | 'success'        // Verification successful
  | 'error';         // Error occurred

/**
 * OTP flow context for state management
 */
export interface OTPFlowContext {
  /** Current flow state */
  state: OTPFlowState;
  /** Phone number being verified */
  phoneNumber: string;
  /** Seconds remaining in cooldown */
  cooldownRemaining: number;
  /** Seconds until OTP expires */
  expiresIn: number;
  /** Error message if state is 'error' */
  errorMessage?: string;
  /** Error code for programmatic handling */
  errorCode?: PhoneOTPErrorCode;
  /** Remaining verification attempts */
  attemptsRemaining?: number;
  /** Number of coupons claimed on success */
  couponsClaimed?: number;
}
