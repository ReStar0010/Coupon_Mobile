import { clearTokens } from '../auth/tokenStore';
import { apiClient } from './client';
import { normalizeError } from './errors';
import type { UserProfile } from './profile';

export interface LoginResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}

export interface RegisterData {
  email?: string;
  phone?: string;
  password: string;
  displayName?: string;
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
  user: UserProfile;
}

export async function login(
  email: string | undefined,
  phone: string | undefined,
  password: string,
): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<LoginResponse>('/api/auth/login/', {
      email,
      phone,
      password,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function register(data: RegisterData): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<LoginResponse>('/api/auth/register/', data);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function refreshToken(refresh: string): Promise<TokenRefreshResponse> {
  try {
    const response = await apiClient.post<TokenRefreshResponse>('/api/auth/token/refresh/', {
      refresh,
    });
    return response.data;
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
    const response = await apiClient.post<OtpVerifyResponse>('/api/phone-otp/verify/', {
      phone_number: phoneNumber,
      otp_code: otpCode,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export interface ForgotPasswordResponse {
  detail: string;
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  try {
    const response = await apiClient.post<ForgotPasswordResponse>('/api/auth/forgot-password/', {
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
    const response = await apiClient.post<ForgotPasswordResponse>('/api/auth/reset-password/', {
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
      '/api/auth/email-settings/send-verification/',
      { email },
    );
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/api/auth/logout/');
  } catch {
    // Always clear tokens locally, even on network error
  } finally {
    await clearTokens();
  }
}
