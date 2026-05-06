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

export async function requestOtp(phone: string): Promise<OtpResponse> {
  try {
    const response = await apiClient.post<OtpResponse>('/api/auth/otp/send/', { phone });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function verifyOtp(phone: string, code: string): Promise<OtpVerifyResponse> {
  try {
    const response = await apiClient.post<OtpVerifyResponse>('/api/auth/otp/verify/', {
      phone,
      code,
    });
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
