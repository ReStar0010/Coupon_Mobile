/**
 * TypeScript interfaces and API functions for Phone OTP Verification
 * Feature: 002-phone-otp-verification
 */

import { authAPI } from '../utils/authAPI';

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
    請輸入有效的台灣手機號碼: PhoneOTPErrorCode.INVALID_FORMAT,
    此電話號碼已被其他帳號使用: PhoneOTPErrorCode.PHONE_TAKEN,
    已超過每小時OTP請求次數限制: PhoneOTPErrorCode.RATE_LIMIT_HOURLY,
    請等待60秒後再重新發送驗證碼: PhoneOTPErrorCode.RATE_LIMIT_COOLDOWN,
    驗證碼錯誤: PhoneOTPErrorCode.INVALID_OTP,
    驗證碼已過期: PhoneOTPErrorCode.OTP_EXPIRED,
    驗證碼輸入錯誤次數過多: PhoneOTPErrorCode.MAX_ATTEMPTS,
    找不到待驗證的OTP: PhoneOTPErrorCode.NO_PENDING_OTP,
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
  | 'idle' // Initial state, showing phone input
  | 'sending' // Sending OTP request
  | 'sent' // OTP sent, showing code input
  | 'verifying' // Verifying OTP code
  | 'success' // Verification successful
  | 'error'; // Error occurred

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

// ============================================================================
// API Functions
// ============================================================================

/**
 * Send OTP to phone number for verification
 * @param phoneNumber Taiwan mobile number (09XXXXXXXX format)
 * @returns SendOTPResponse on success
 * @throws Error with ErrorResponse data on failure
 */
export async function sendOtp(phoneNumber: string): Promise<SendOTPResponse> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const response = await authAPI.post<SendOTPResponse | ErrorResponse>('/phone-otp/send/', {
    phone_number: normalized,
  });

  if ('error' in response) {
    throw response;
  }

  return response;
}

/**
 * Verify OTP and update user's phone number
 * @param phoneNumber Phone number that received the OTP
 * @param otpCode 6-digit verification code
 * @returns VerifyOTPResponse on success
 * @throws Error with ErrorResponse data on failure
 */
export async function verifyOtp(phoneNumber: string, otpCode: string): Promise<VerifyOTPResponse> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const response = await authAPI.post<VerifyOTPResponse | ErrorResponse>('/phone-otp/verify/', {
    phone_number: normalized,
    otp_code: otpCode,
  });

  if ('error' in response) {
    throw response;
  }

  return response;
}

/**
 * Get user's current phone number
 * @returns GetPhoneResponse with phone number or null
 */
export async function getPhone(): Promise<GetPhoneResponse> {
  return authAPI.get<GetPhoneResponse>('/user/phone/');
}

// ============================================================================
// REGISTRATION OTP API (Unauthenticated)
// ============================================================================

/**
 * Request body for POST /api/register/check-phone/
 */
export interface RegistrationPhoneLookupRequest {
  phone_number: string;
}

/**
 * Response from POST /api/register/check-phone/
 */
export interface RegistrationPhoneLookupResponse {
  registered: boolean;
}

/**
 * Check whether a phone number already has a StudentProfile (no SMS).
 */
export async function checkRegistrationPhone(
  phoneNumber: string,
): Promise<RegistrationPhoneLookupResponse> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const response = await authAPI.post<RegistrationPhoneLookupResponse | ErrorResponse>(
    '/register/check-phone/',
    { phone_number: normalized },
  );

  if ('error' in response) {
    throw response;
  }

  return response;
}

/**
 * Request body for POST /api/register/send-otp/
 */
export interface RegistrationOTPSendRequest {
  /** Taiwan mobile number (09XXXXXXXX format) */
  phone_number: string;
}

/**
 * Response from POST /api/register/send-otp/
 */
export interface RegistrationOTPSendResponse {
  /** Success message with masked phone */
  message: string;
  /** Seconds until resend is allowed */
  cooldown_seconds: number;
  /** Seconds until OTP expires */
  expires_in_seconds: number;
  /** True if running in development mode */
  dev_mode?: boolean;
  /** OTP code (only in dev mode) */
  otp_code?: string;
}

/**
 * Request body for POST /api/register/verify-otp/
 */
export interface RegistrationOTPVerifyRequest {
  /** Phone number that received the OTP */
  phone_number: string;
  /** 6-digit verification code */
  otp_code: string;
  /** Password for the new account */
  password: string;
}

/**
 * Response from POST /api/register/verify-otp/
 */
export interface RegistrationOTPVerifyResponse {
  /** Success message */
  message: string;
  /** JWT access token */
  access_token: string;
  /** JWT refresh token */
  refresh_token: string;
  /** User information */
  user: {
    username: string;
    phone_number: string;
    phone_verified: boolean;
  };
  /** Number of coupons claimed on registration (if any) */
  coupons_claimed?: number;
}

/**
 * Send registration OTP to phone number (unauthenticated)
 * @param phoneNumber Taiwan mobile number (09XXXXXXXX format)
 * @returns RegistrationOTPSendResponse on success
 * @throws Error with ErrorResponse data on failure
 */
export async function sendRegistrationOtp(
  phoneNumber: string,
): Promise<RegistrationOTPSendResponse> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const response = await authAPI.post<RegistrationOTPSendResponse | ErrorResponse>(
    '/register/send-otp/',
    { phone_number: normalized },
  );

  if ('error' in response) {
    throw response;
  }

  return response;
}

/**
 * Verify registration OTP and create account (unauthenticated)
 * @param phoneNumber Phone number that received the OTP
 * @param otpCode 6-digit verification code
 * @param password Password for the new account
 * @returns RegistrationOTPVerifyResponse with JWT tokens on success
 * @throws Error with ErrorResponse data on failure
 */
export async function verifyRegistrationOtp(
  phoneNumber: string,
  otpCode: string,
  password: string,
): Promise<RegistrationOTPVerifyResponse> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const response = await authAPI.post<RegistrationOTPVerifyResponse | ErrorResponse>(
    '/register/verify-otp/',
    {
      phone_number: normalized,
      otp_code: otpCode,
      password: password,
    },
  );

  if ('error' in response) {
    throw response;
  }

  return response;
}

// ============================================================================
// FORGOT PASSWORD OTP API (Unauthenticated)
// ============================================================================

/**
 * Request body for POST /api/forgot-password/phone/send-otp/
 */
export interface ForgotPasswordPhoneSendRequest {
  /** Registered phone number */
  phone_number: string;
}

/**
 * Response from POST /api/forgot-password/phone/send-otp/
 */
export interface ForgotPasswordPhoneSendResponse {
  /** Success message with masked phone */
  message: string;
  /** Seconds until resend is allowed */
  cooldown_seconds: number;
  /** Seconds until OTP expires */
  expires_in_seconds: number;
  /** True if running in development mode */
  dev_mode?: boolean;
  /** OTP code (only in dev mode) */
  otp_code?: string;
}

/**
 * Request body for POST /api/forgot-password/phone/reset/
 */
export interface ForgotPasswordPhoneResetRequest {
  /** Phone number that received the OTP */
  phone_number: string;
  /** 6-digit verification code */
  otp_code: string;
  /** New password */
  new_password: string;
}

/**
 * Response from POST /api/forgot-password/phone/reset/
 */
export interface ForgotPasswordPhoneResetResponse {
  /** Success message */
  message: string;
}

/**
 * Send password reset OTP to registered phone (unauthenticated)
 * @param phoneNumber Registered phone number
 * @returns ForgotPasswordPhoneSendResponse on success
 * @throws Error with ErrorResponse data on failure
 */
export async function sendPasswordResetOtp(
  phoneNumber: string,
): Promise<ForgotPasswordPhoneSendResponse> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const response = await authAPI.post<ForgotPasswordPhoneSendResponse | ErrorResponse>(
    '/forgot-password/phone/send-otp/',
    { phone_number: normalized },
  );

  if ('error' in response) {
    throw response;
  }

  return response;
}

/**
 * Verify password reset OTP and set new password (unauthenticated)
 * @param phoneNumber Phone number that received the OTP
 * @param otpCode 6-digit verification code
 * @param newPassword New password to set
 * @returns ForgotPasswordPhoneResetResponse on success
 * @throws Error with ErrorResponse data on failure
 */
export async function verifyPasswordResetOtp(
  phoneNumber: string,
  otpCode: string,
  newPassword: string,
): Promise<ForgotPasswordPhoneResetResponse> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const response = await authAPI.post<ForgotPasswordPhoneResetResponse | ErrorResponse>(
    '/forgot-password/phone/reset/',
    {
      phone_number: normalized,
      otp_code: otpCode,
      new_password: newPassword,
    },
  );

  if ('error' in response) {
    throw response;
  }

  return response;
}
