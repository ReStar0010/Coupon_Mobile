import { clearTokens } from '../auth/tokenStore';
import { apiClient } from './client';
import { ApiRequestError, normalizeError } from './errors';
import type { UserProfile } from './profile';

// The consumer app always identifies itself as 'user'; the merchant app
// uses 'merchant'. Hard-coded here so callers don't have to thread it.
const CLIENT_TYPE_USER = 'user' as const;

/**
 * Tokens-only login response. The BE returns
 * {access_token, refresh_token, user_id, token_type, expires_in, message}
 * but the FE only needs the two tokens here — the caller (AuthContext)
 * fetches the full profile via getProfile() after the tokens land in
 * the secure store.
 */
export interface LoginResponse {
  access: string;
  refresh: string;
}

interface BackendLoginResponse {
  access_token: string;
  refresh_token: string;
  user_id?: number;
  token_type?: string;
  expires_in?: number;
  message?: string;
}

// BE enforces Taiwan mobile format 09XXXXXXXX. Reject anything else on the
// client so users get a clear message instead of a generic 400 from DRF.
const TW_MOBILE_PATTERN = /^09\d{8}$/;

export function normalizeTwPhone(input: string): string {
  const stripped = input.replace(/[-\s()]/g, '');
  if (!TW_MOBILE_PATTERN.test(stripped)) {
    throw new ApiRequestError('請輸入有效的台灣手機號碼 (09開頭，共10碼)', 0);
  }
  return stripped;
}

export interface TokenRefreshResponse {
  access: string;
  refresh: string;
}

export interface OtpResponse {
  detail: string;
}

export interface OtpVerifyResponse {
  access: string;
  refresh: string;
  /** Populated by some BE OTP flows; if absent the caller should call getProfile(). */
  user?: UserProfile;
}

/**
 * Log in via either email + password or phone + password (mutually
 * exclusive). The server's PhoneLoginSerializer requires `client_type`,
 * which we hard-code to 'user' since this is the consumer app.
 */
export async function login(
  email: string | undefined,
  phone: string | undefined,
  password: string,
): Promise<LoginResponse> {
  try {
    const body: Record<string, unknown> = {
      password,
      client_type: CLIENT_TYPE_USER,
    };
    if (email) body.email = email;
    if (phone) body.phone_number = phone;
    const response = await apiClient.post<BackendLoginResponse>('/api/login/', body);
    return {
      access: response.data.access_token,
      refresh: response.data.refresh_token,
    };
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Phone-based registration step 1: send a 6-digit OTP to the phone number.
 *
 * Note: we intentionally do NOT pre-check whether the phone is already
 * registered before this call. A public "does this phone exist?" endpoint
 * is an account-enumeration vector. The BE returns a clear error when the
 * phone is taken and that error message is surfaced to the user as-is.
 */
export async function sendRegistrationOtp(phoneNumber: string): Promise<OtpResponse> {
  try {
    const response = await apiClient.post<OtpResponse>('/api/register/send-otp/', {
      phone_number: phoneNumber,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Phone-based registration step 2: verify OTP and create the account with
 * the supplied password. BE returns access/refresh tokens inline so the
 * caller can drop straight into the authed state.
 */
export async function registerWithPhone(
  phoneNumber: string,
  otpCode: string,
  password: string,
): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<BackendLoginResponse>(
      '/api/register/verify-otp/',
      {
        phone_number: phoneNumber,
        otp_code: otpCode,
        password,
      },
    );
    return {
      access: response.data.access_token,
      refresh: response.data.refresh_token,
    };
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function refreshToken(refresh: string): Promise<TokenRefreshResponse> {
  try {
    // BE accepts {refresh_token} and returns {access_token, refresh_token, ...}
    const response = await apiClient.post<BackendLoginResponse>('/api/token/refresh/', {
      refresh_token: refresh,
    });
    return {
      access: response.data.access_token,
      refresh: response.data.refresh_token,
    };
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function requestOtp(phoneNumber: string): Promise<OtpResponse> {
  try {
    const response = await apiClient.post<OtpResponse>('/api/phone-otp/send/', {
      phone_number: phoneNumber,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function verifyOtp(phoneNumber: string, otpCode: string): Promise<OtpVerifyResponse> {
  try {
    // BE returns {message, access_token, refresh_token, ...} — normalise.
    const response = await apiClient.post<BackendLoginResponse>('/api/phone-otp/verify/', {
      phone_number: phoneNumber,
      otp_code: otpCode,
    });
    return {
      access: response.data.access_token,
      refresh: response.data.refresh_token,
    };
  } catch (error) {
    throw normalizeError(error);
  }
}

export interface ForgotPasswordResponse {
  detail: string;
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  try {
    const response = await apiClient.post<ForgotPasswordResponse>('/api/forgot-password/', {
      email,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function resetPassword(
  email: string,
  token: string,
  newPassword: string,
): Promise<ForgotPasswordResponse> {
  try {
    const response = await apiClient.post<ForgotPasswordResponse>('/api/reset-password/', {
      email,
      token,
      new_password: newPassword,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function requestEmailVerification(email: string): Promise<ForgotPasswordResponse> {
  try {
    const response = await apiClient.post<ForgotPasswordResponse>(
      '/api/email-settings/send-verification/',
      { email },
    );
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    // No /api/auth/logout/ route exists. Token blacklisting happens via
    // refresh-token rotation on the backend; for the FE, clearing local
    // tokens is enough to log the user out of the app.
  } catch {
    // ignore
  } finally {
    await clearTokens();
  }
}
