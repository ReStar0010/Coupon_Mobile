/**
 * API and Authentication utilities for Merchant Frontend
 * Handles API calls, token management, and authentication
 */

// ============================================
// 🔧 配置區域 - 後端設置（與 Mobile-Frontend 對齊）
// ============================================

/**
 * API 配置
 *
 * 生產環境 URL 永遠寫死在程式碼中，確保 production build 絕不會使用錯誤的後端。
 * Staging 僅在 __DEV__ 模式下可透過 EXPO_PUBLIC_USE_STAGING 開啟，不影響 production/development build。
 *
 * 使用方式：
 * 1. 設定 EXPO_PUBLIC_BACKEND_MODE 來切換不同的後端
 * 2. 若使用 'local-network'，請設定 EXPO_PUBLIC_LOCAL_HOST
 *
 * 模式說明：
 * - 'production': 使用 Render.com 生產環境
 * - 'local': 使用 localhost (僅適用於模擬器/瀏覽器)
 * - 'local-network': 使用本地網絡 IP (適用於 Expo Go 在真實設備上)
 */

type BackendMode = 'production' | 'local' | 'local-network';

/** 生產環境 API URL - 寫死於程式碼，production build 永遠使用此 */
const PRODUCTION_API_URL = 'https://coupon-mobile.onrender.com';

// 1. 集中讀取與處理環境變數（僅在 __DEV__ 時有意義）
const ENV = {
  MODE: (process.env.EXPO_PUBLIC_BACKEND_MODE ?? 'production') as BackendMode,
  PORT: Number(process.env.EXPO_PUBLIC_LOCAL_PORT ?? 8000),
  HOST: (process.env.EXPO_PUBLIC_LOCAL_HOST ?? '').trim(),
  USE_STAGING: process.env.EXPO_PUBLIC_USE_STAGING === 'true',
  STAGING_URL: (process.env.EXPO_PUBLIC_STAGING_API_URL ?? '').trim(),
  DEV_OVERRIDE_URL: (process.env.EXPO_PUBLIC_API_URL ?? '').trim(),
};

// 2. 工具函數：標準化 URL (移除結尾斜線，確保有 protocol)
const normalizeUrl = (url: string): string => {
  if (!url) return '';
  const hasProtocol = url.startsWith('http://') || url.startsWith('https://');
  return (hasProtocol ? url : `https://${url}`).replace(/\/+$/, '');
};

// ============================================
// 自動配置（不需要修改）
// ============================================

// 3. 核心邏輯：解析 Base URL
const resolveBaseUrl = (): string => {
  // Production 與 release build：永遠使用生產 URL，忽略所有 env
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return normalizeUrl(PRODUCTION_API_URL);
  }

  switch (ENV.MODE) {
    case 'local':
      return `http://localhost:${ENV.PORT}`;

    case 'local-network': {
      return normalizeUrl(ENV.HOST);
    }

    case 'production':
    default: {
      // 僅在 __DEV__ 時：可選 staging 或 dev override
      if (ENV.USE_STAGING && ENV.STAGING_URL) {
        return normalizeUrl(ENV.STAGING_URL);
      }
      if (ENV.DEV_OVERRIDE_URL) {
        return normalizeUrl(ENV.DEV_OVERRIDE_URL);
      }
      return normalizeUrl(PRODUCTION_API_URL);
    }
  }
};

const BASE_URL: string = resolveBaseUrl();
const API_BASE_URL: string = `${BASE_URL}/api`;

// 導出用於調試
export const getApiConfig = () => ({
  mode: ENV.MODE,
  baseUrl: BASE_URL,
  apiUrl: API_BASE_URL,
});

// Helper function to convert relative media URL to absolute URL
const getAbsoluteImageUrl = (imageUrl: string | null | undefined): string | null => {
  if (!imageUrl) return null;

  // If already an absolute URL (starts with http:// or https://), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If it's a relative path (starts with /), prepend base URL
  if (imageUrl.startsWith('/')) {
    return `${BASE_URL}${imageUrl}`;
  }

  // Otherwise, assume it's a relative path and prepend base URL with /media/
  return `${BASE_URL}/media/${imageUrl}`;
};

// 在開發模式下打印當前配置
if (process.env.NODE_ENV !== 'production') {
  const config = getApiConfig();
  console.log('\n' + '='.repeat(50));
  console.log('🔧 當前後端配置 (Merchant Frontend)');
  console.log('='.repeat(50));
  console.log(`模式: ${config.mode}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`API URL: ${config.apiUrl}`);
  console.log('='.repeat(50) + '\n');
}

// Token storage keys
const ACCESS_TOKEN_KEY = 'merchant_access_token';
const REFRESH_TOKEN_KEY = 'merchant_refresh_token';

// Simple storage interface (can be replaced with AsyncStorage if available)
let tokenStorage: {
  access_token: string | null;
  refresh_token: string | null;
} = {
  access_token: null,
  refresh_token: null,
};

// Initialize storage (using in-memory for now, can be upgraded to AsyncStorage)
export const initStorage = async () => {
  try {
    // Try to use AsyncStorage if available
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    tokenStorage.access_token = accessToken;
    tokenStorage.refresh_token = refreshToken;
    console.log('[Storage] Loaded tokens from AsyncStorage:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });
  } catch {
    // Fallback to in-memory storage
    console.log('[Storage] AsyncStorage not available, using in-memory storage');
    console.log('[Storage] Current in-memory tokens:', {
      hasAccessToken: !!tokenStorage.access_token,
      hasRefreshToken: !!tokenStorage.refresh_token,
    });
  }
};

// Save tokens
export const saveTokens = async (accessToken: string, refreshToken: string) => {
  tokenStorage.access_token = accessToken;
  tokenStorage.refresh_token = refreshToken;
  console.log('[Storage] Saving tokens:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
  });

  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    console.log('[Storage] Tokens saved to AsyncStorage');
  } catch {
    // Fallback to in-memory storage
    console.log('[Storage] Failed to save to AsyncStorage, using in-memory storage');
  }
};

// Get access token
export const getAccessToken = (): string | null => {
  return tokenStorage.access_token;
};

// Get refresh token
export const getRefreshToken = (): string | null => {
  return tokenStorage.refresh_token;
};

// Clear tokens
export const clearTokens = async () => {
  tokenStorage.access_token = null;
  tokenStorage.refresh_token = null;

  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Fallback to in-memory storage
  }
};

// Check if endpoint is public
const isPublicEndpoint = (endpoint: string): boolean => {
  const publicEndpoints = [
    '/login/',
    '/register/',
    '/forgot-password/',
    '/reset-password/',
    '/verify-email/',
    '/merchant/verify-email/',
    '/merchant/resend-verification/',
  ];
  return publicEndpoints.some((path) => endpoint.includes(path));
};

/**
 * Custom error class for authentication failures
 * Components can check for this error type to trigger redirect to login
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Custom error class for merchant authorization failures
 * Thrown when user is authenticated but not a merchant (403 Forbidden)
 */
export class MerchantAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MerchantAuthorizationError';
  }
}

// Token refresh state
let isRefreshing = false;
let refreshSubscribers: ((success: boolean) => void)[] = [];

const subscribeToRefresh = (callback: (success: boolean) => void) => {
  refreshSubscribers.push(callback);
};

const onRefreshComplete = (success: boolean) => {
  refreshSubscribers.forEach((callback) => callback(success));
  refreshSubscribers = [];
};

// Refresh access token
const refreshAccessToken = async (): Promise<boolean> => {
  if (isRefreshing) {
    return new Promise<boolean>((resolve) => {
      subscribeToRefresh(resolve);
    });
  }

  isRefreshing = true;
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    isRefreshing = false;
    onRefreshComplete(false);
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      isRefreshing = false;
      onRefreshComplete(false);
      return false;
    }

    const data = await response.json();
    // Support both response formats: { access_token, refresh_token } and { access, refresh }
    const accessToken = data.access_token || data.access;
    const newRefreshToken = data.refresh_token || data.refresh;

    if (accessToken) {
      await saveTokens(accessToken, newRefreshToken || refreshToken);
      console.log('[API] Token refresh successful, new tokens saved');
      isRefreshing = false;
      onRefreshComplete(true);
      return true;
    }

    console.error('[API] Token refresh failed: No access token in response');
    isRefreshing = false;
    onRefreshComplete(false);
    return false;
  } catch (error) {
    console.error('Token refresh error:', error);
    isRefreshing = false;
    onRefreshComplete(false);
    return false;
  }
};

// Main API fetch function
export interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

export const fetchAPI = async (endpoint: string, options: FetchOptions = {}): Promise<Response> => {
  const { requireAuth = true, ...fetchOptions } = options;

  // Build headers
  const headers = new Headers(fetchOptions.headers);
  headers.set('Content-Type', 'application/json');

  // Add auth token if required
  if (requireAuth && !isPublicEndpoint(endpoint)) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  // Make request
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('[API] Making request to:', url);

    let response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && requireAuth && !isPublicEndpoint(endpoint)) {
      console.log('[API] Received 401, attempting token refresh');
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // Retry request with new token
        const newAccessToken = getAccessToken();
        if (newAccessToken) {
          headers.set('Authorization', `Bearer ${newAccessToken}`);
          response = await fetch(url, {
            ...fetchOptions,
            headers,
          });

          // If retry still returns 401, authentication has failed
          if (response.status === 401) {
            console.log('[API] Retry after refresh still returned 401, authentication failed');
            await clearTokens();
            throw new AuthenticationError(
              'Authentication failed after token refresh. Please log in again.',
            );
          }
        } else {
          console.log('[API] Token refresh succeeded but no access token available');
          await clearTokens();
          throw new AuthenticationError('Token refresh succeeded but no access token available.');
        }
      } else {
        // Refresh failed, clear tokens
        console.log('[API] Token refresh failed, clearing tokens and throwing AuthenticationError');
        await clearTokens();
        throw new AuthenticationError('Authentication failed. Please log in again.');
      }
    }

    return response;
  } catch (error: any) {
    console.error('[API] Request error:', error);
    console.error('[API] Request URL:', `${API_BASE_URL}${endpoint}`);
    console.error('[API] Error details:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });

    // Provide more helpful error messages
    if (error?.message === 'Network request failed' || error?.message?.includes('Network')) {
      const helpfulMessage = `無法連接到服務器。請檢查：
1. 後端服務器是否正在運行
2. API URL 是否正確: ${API_BASE_URL}
3. 如果使用實體設備，請使用您的電腦 IP 地址而不是 localhost
4. 如果使用 Android 模擬器，請使用 10.0.2.2 代替 localhost`;
      throw new Error(helpfulMessage);
    }

    throw error;
  }
};

/** Error with HTTP status for components to distinguish expected (4xx) vs unexpected errors */
export type ApiError = Error & {
  statusCode?: number;
  errorCode?: string;
  context?: Record<string, unknown>;
};

function createApiError(
  message: string,
  status: number,
  errorCode?: string,
  context?: Record<string, unknown>,
): ApiError {
  const err = new Error(message) as ApiError;
  err.statusCode = status;
  if (errorCode !== undefined) err.errorCode = errorCode;
  if (context !== undefined) err.context = context;
  return err;
}

/**
 * Maps legacy backend error string values to standardised error_code constants.
 * Used as a fallback while views are being migrated to raise CouProAPIException.
 */
const LEGACY_ERROR_MAP: Record<string, string> = {
  email_not_verified: 'EMAIL_NOT_VERIFIED',
  wrong_client_type: 'WRONG_CLIENT_TYPE_USER',
  missing_token: 'MISSING_TOKEN',
  already_verified: 'ALREADY_VERIFIED',
  expired_token: 'EXPIRED_TOKEN',
  invalid_token: 'INVALID_TOKEN',
  missing_email: 'FIELD_REQUIRED',
  email_send_failed: 'EMAIL_SEND_FAILED',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
};

// Helper function to parse JSON response
export const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      // If response is not JSON, try to get text
      const text = await response.text().catch(() => 'Unknown error');
      errorData = { error: text || `HTTP ${response.status}` };
    }

    console.error('[API] Response error:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
    });

    const status = response.status;

    // Extract error message from various possible formats
    // Handle Django REST Framework error format
    if (typeof errorData === 'object' && errorData !== null) {
      // ✅ New standardised format: {error_code, developer_message, context}
      if (errorData.error_code) {
        throw createApiError(
          errorData.developer_message || errorData.error_code,
          status,
          errorData.error_code,
          errorData.context ?? {},
        );
      }

      // Special handling for email_not_verified error - preserve original structure
      if (errorData.error === 'email_not_verified') {
        const unverifiedError: any = new Error(errorData.message || '請先驗證您的電子郵件');
        unverifiedError.error = 'email_not_verified';
        unverifiedError.email = errorData.email;
        unverifiedError.statusCode = status;
        unverifiedError.errorCode = 'EMAIL_NOT_VERIFIED';
        unverifiedError.context = {};
        throw unverifiedError;
      }

      // Special handling for 403 wrong_client_type (user tried to log in on wrong app)
      if (response.status === 403 && errorData.error === 'wrong_client_type') {
        const wrongClientError: any = new Error(errorData.message || '請使用正確的 App 登入');
        wrongClientError.error = 'wrong_client_type';
        wrongClientError.statusCode = status;
        wrongClientError.errorCode = 'WRONG_CLIENT_TYPE_USER';
        wrongClientError.context = {};
        throw wrongClientError;
      }

      // Special handling for 403 "User is not a merchant" error
      // This happens when a non-merchant user tries to access merchant endpoints
      if (
        response.status === 403 &&
        (errorData.error === 'User is not a merchant.' ||
          errorData.message === 'User is not a merchant.' ||
          errorData.error?.includes('not a merchant') ||
          errorData.message?.includes('not a merchant'))
      ) {
        console.error(
          '[API] User is not a merchant, clearing tokens and throwing MerchantAuthorizationError',
        );
        // Clear tokens since user is not authorized for merchant endpoints
        await clearTokens();
        const merchantErr = new MerchantAuthorizationError(
          '您不是商家用戶，無法使用商家功能。',
        ) as MerchantAuthorizationError & { statusCode?: number };
        merchantErr.statusCode = status;
        throw merchantErr;
      }

      // Check for field-specific errors (e.g., {phone: ['This field is required.']})
      const fieldErrors: string[] = [];
      for (const [key, value] of Object.entries(errorData)) {
        if (Array.isArray(value)) {
          fieldErrors.push(`${key}: ${value.join(', ')}`);
        } else if (typeof value === 'string') {
          fieldErrors.push(`${key}: ${value}`);
        } else if (Array.isArray(value) && value.length > 0) {
          fieldErrors.push(`${key}: ${value[0]}`);
        }
      }

      if (fieldErrors.length > 0) {
        throw createApiError(fieldErrors.join('\n'), status);
      }

      // Check for general error fields
      const errorMessage =
        errorData.error ||
        errorData.message ||
        errorData.detail ||
        errorData.non_field_errors?.[0] ||
        `HTTP ${response.status}: ${response.statusText}`;

      // Attempt to map legacy error string to a standardised error_code
      const legacyCode =
        typeof errorData.error === 'string' ? LEGACY_ERROR_MAP[errorData.error] : undefined;

      throw createApiError(errorMessage, status, legacyCode, {});
    }

    // If errorData is a string
    if (typeof errorData === 'string') {
      throw createApiError(errorData, status);
    }

    throw createApiError(`HTTP ${response.status}: ${response.statusText}`, status);
  }
  return response.json();
};

// ============================================
// TypeScript Interfaces for Auth API
// ============================================

export interface VerificationSuccessResponse {
  success: boolean;
  message: string;
}

export interface VerificationErrorResponse {
  error: 'missing_token' | 'invalid_token' | 'expired_token' | 'already_verified';
  message: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
}

export interface RateLimitErrorResponse {
  error: 'rate_limit_exceeded';
  message: string;
  wait_seconds: number;
}

export interface UnverifiedErrorResponse {
  error: 'email_not_verified';
  message: string;
  email: string;
}

export interface UserInfoResponse {
  id: number;
  email: string;
  verified: boolean;
  is_merchant: boolean;
  message: string;
  date_joined: string;
  merchant_profile?: {
    phone?: string;
    contact_person?: string;
    contact_info?: string;
  };
  store?: {
    id: number;
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
    business_hours?: string;
  };
}

// ============================================
// TypeScript Interfaces for Merchant API
// ============================================

export interface MerchantProfileResponse {
  merchant: {
    id: number;
    email: string;
    phone?: string;
    contact_person?: string;
    contact_info?: string;
  };
  store?: {
    id: number;
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
    business_hours?: string;
    image_url?: string;
    store_type?: string;
  };
}

/** Merchant statistics (009: includes today_cost 今日成本) */
export interface MerchantStatisticsResponse {
  active_coupons: number;
  total_redemptions: number;
  total_views: number;
  total_templates?: number;
  total_coupons_generated?: number;
  today_cost: number;
  today_cost_currency?: string | null;
}

// Auth API functions
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await fetchAPI('/login/', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify({ email, password, client_type: 'merchant' }),
    });
    const data = await parseResponse<{
      access_token: string;
      refresh_token: string;
      user_id: number;
      message: string;
    }>(response);

    if (data.access_token && data.refresh_token) {
      await saveTokens(data.access_token, data.refresh_token);
    }

    return data;
  },

  register: async (formData: {
    email: string;
    password: string;
    user_type: 'merchant';
    phone: string;
    contact_person?: string;
    contact_info?: string;
    store_name?: string;
    store_address?: string;
    store_lat?: number;
    store_lng?: number;
    business_hours?: string;
  }) => {
    const response = await fetchAPI('/register/', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify(formData),
    });
    return parseResponse<{ verification_required?: boolean }>(response);
  },

  forgotPassword: async (email: string) => {
    const response = await fetchAPI('/forgot-password/', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify({ email }),
    });
    return parseResponse(response);
  },

  logout: async () => {
    try {
      await fetchAPI('/logout/', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await clearTokens();
    }
  },

  getUserInfo: async (): Promise<UserInfoResponse> => {
    const response = await fetchAPI('/user-info/');
    return parseResponse<UserInfoResponse>(response);
  },

  verifyEmail: async (token: string): Promise<VerificationSuccessResponse> => {
    const response = await fetchAPI(`/merchant/verify-email/?token=${token}`, {
      method: 'GET',
      requireAuth: false,
    });
    return parseResponse(response);
  },

  resendVerification: async (email: string): Promise<ResendVerificationResponse> => {
    const response = await fetchAPI('/merchant/resend-verification/', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify({ email }),
    });
    return parseResponse(response);
  },

  resetPassword: async (email: string, token: string, newPassword: string) => {
    const response = await fetchAPI('/reset-password/', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify({ email, token, new_password: newPassword }),
    });
    return parseResponse(response);
  },
};

// Merchant API functions
export const merchantAPI = {
  // Profile
  getProfile: async (): Promise<MerchantProfileResponse> => {
    const response = await fetchAPI('/merchant/profile/');
    return parseResponse<MerchantProfileResponse>(response);
  },

  updateProfile: async (data: {
    phone?: string;
    contact_person?: string;
    contact_info?: string;
    store_name?: string;
    store_address?: string;
    store_lat?: number;
    store_lng?: number;
    business_hours?: string;
    image_url?: string;
    store_type?: string;
  }) => {
    const response = await fetchAPI('/merchant/profile/update/', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return parseResponse(response);
  },

  getStatistics: async (): Promise<MerchantStatisticsResponse> => {
    const response = await fetchAPI('/merchant/statistics/');
    return parseResponse(response);
  },

  /**
   * Get template analytics. Use either date_from+date_to (calendar range) or days (3,7,30,90).
   * When both date_from and date_to are provided, they take precedence over days.
   */
  getTemplateAnalytics: async (
    templateId: number,
    options?: { date_from?: string; date_to?: string; days?: number },
  ) => {
    const params = new URLSearchParams();
    if (options?.date_from && options?.date_to) {
      params.set('date_from', options.date_from);
      params.set('date_to', options.date_to);
    } else {
      const days = options?.days ?? 30;
      params.set('days', String(days));
    }
    const response = await fetchAPI(
      `/merchant/coupon-templates/${templateId}/analytics/?${params.toString()}`,
    );
    return parseResponse(response);
  },

  // Coupon Templates
  listTemplates: async () => {
    const response = await fetchAPI('/merchant/coupon-templates/');
    return parseResponse(response);
  },

  getTemplate: async (id: number) => {
    const response = await fetchAPI(`/merchant/coupon-templates/${id}/`);
    return parseResponse(response);
  },

  createTemplate: async (data: {
    coupon_name: string;
    coupon_detail: string;
    important_notes?: string;
    image_url?: string;
    estimated_savings?: number;
    template_redeem_code?: string;
    total_quantity: number;
    start_date: string;
    expiry_date: string;
    draw_probability?: number;
    is_active?: boolean;
    tags?: number[];
  }) => {
    const response = await fetchAPI('/merchant/coupon-templates/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return parseResponse(response);
  },

  updateTemplate: async (
    id: number,
    data: Partial<{
      coupon_name: string;
      coupon_detail: string;
      important_notes: string;
      image_url: string;
      estimated_savings: number;
      template_redeem_code: string;
      total_quantity: number;
      start_date: string;
      expiry_date: string;
      draw_probability: number;
      is_active: boolean;
      tags: number[];
    }>,
  ) => {
    const response = await fetchAPI(`/merchant/coupon-templates/${id}/update/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return parseResponse(response);
  },

  deleteTemplate: async (id: number) => {
    const response = await fetchAPI(`/merchant/coupon-templates/${id}/delete/`, {
      method: 'DELETE',
    });
    return parseResponse(response);
  },

  // Redemption
  redeem: async (templateId: number, phoneNumber: string) => {
    const response = await fetchAPI('/merchant/redeem/', {
      method: 'POST',
      body: JSON.stringify({
        template_id: templateId,
        phone_number: phoneNumber,
      }),
    });
    return parseResponse(response);
  },

  // Phone-based coupon send
  consolidateCoupon: async (templateId: number, phoneNumber: string) => {
    const response = await fetchAPI('/merchant/consolidate-coupon/', {
      method: 'POST',
      body: JSON.stringify({
        template_id: templateId,
        phone_number: phoneNumber,
      }),
    });
    return parseResponse<{
      message: string;
      coupon_name: string;
      remaining_quantity: number;
      recipient_status: 'registered' | 'pending';
      pending_phone?: string;
    }>(response);
  },

  // Refresh redeem code
  refreshRedeemCode: async (templateId: number, newRedeemCode: string) => {
    const response = await fetchAPI('/merchant/refresh_redeem_code/', {
      method: 'POST',
      body: JSON.stringify({
        template_id: templateId,
        new_redeem_code: newRedeemCode,
      }),
    });
    return parseResponse(response);
  },

  // Unified redemption code generation
  generateUnifiedRedemptionCode: async () => {
    const response = await fetchAPI('/merchant/unified-redemption/generate/', {
      method: 'POST',
    });
    return parseResponse<{
      unified_redeem_code: string;
      store_id: number;
      store_name: string;
    }>(response);
  },

  // Tags
  getTags: async () => {
    const response = await fetchAPI('/tags/');
    return parseResponse<{ id: number; name: string; display_name: string }[]>(response);
  },

  // QR Code Session
  generateQRSession: async (templateId: number) => {
    const response = await fetchAPI('/merchant/qr-session/generate/', {
      method: 'POST',
      body: JSON.stringify({
        template_id: templateId,
      }),
    });
    return parseResponse<{
      session_id: number;
      template_id: number;
      session_token: string;
      qr_code_data: string;
      claim_link_web?: string;
      claim_link?: string;
      message: string;
    }>(response);
  },

  invalidateQRSession: async (sessionId: number) => {
    const response = await fetchAPI(`/merchant/qr-session/${sessionId}/invalidate/`, {
      method: 'POST',
    });
    return parseResponse<{
      message: string;
      session_id: number;
    }>(response);
  },

  // Image Upload
  uploadImage: async (imageUri: string): Promise<string> => {
    // Create FormData for multipart/form-data request
    const formData = new FormData();

    // Extract filename from URI
    const filename = imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    // For React Native, we need to create a file object
    // @ts-ignore - React Native FormData accepts objects with uri, type, name
    formData.append('image', {
      uri: imageUri,
      type: type,
      name: filename,
    } as any);

    // Get access token for authentication
    const accessToken = getAccessToken();

    // Build headers (don't set Content-Type, let FormData set it with boundary)
    const headers = new Headers();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    // Make request
    const url = `${API_BASE_URL}/merchant/upload-image/`;
    console.log('[API] Uploading image to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    // Parse response
    const result = await parseResponse<{ image_url: string }>(response);
    const relativeUrl = result.image_url;

    // Convert relative URL to absolute URL for image display
    return getAbsoluteImageUrl(relativeUrl) || relativeUrl;
  },
};

// Export helper function for use in components
export { getAbsoluteImageUrl };

// ============================================
// Account Deletion Types & APIs (App Store Compliance)
// ============================================

export interface DeletionWarning {
  code: 'ACTIVE_COUPONS' | 'DATA_LOSS' | 'MULTIPLE_STORES';
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface PreDeleteCheckResponse {
  can_delete: boolean;
  warnings: DeletionWarning[];
  data_summary: {
    active_coupons_count: number;
    stores_count: number;
    total_redemptions: number;
    pending_transactions: number;
  };
}

export interface DeleteAccountRequest {
  password: string;
  acknowledgments: string[];
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
  deleted_at: string;
}

export interface DeletionStatusResponse {
  status: 'none' | 'pending' | 'completed' | 'failed';
  initiated_at?: string;
  completed_at?: string;
  error?: string;
}

/**
 * Account deletion API functions
 */
export const accountDeletionAPI = {
  /**
   * Get pre-deletion check (warnings and data summary)
   */
  async preDeleteCheck(): Promise<PreDeleteCheckResponse> {
    const response = await fetchAPI('/merchant/account/pre-delete-check/', {
      method: 'GET',
    });
    return parseResponse(response);
  },

  /**
   * Delete merchant account
   */
  async deleteAccount(request: DeleteAccountRequest): Promise<DeleteAccountResponse> {
    const response = await fetchAPI('/merchant/account/delete/', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return parseResponse(response);
  },

  /**
   * Get deletion status (for network failure recovery)
   */
  async getDeletionStatus(): Promise<DeletionStatusResponse> {
    const response = await fetchAPI('/merchant/account/deletion-status/', {
      method: 'GET',
    });
    return parseResponse(response);
  },
};
