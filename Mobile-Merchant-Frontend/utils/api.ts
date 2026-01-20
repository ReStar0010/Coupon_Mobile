/**
 * API and Authentication utilities for Merchant Frontend
 * Handles API calls, token management, and authentication
 */

// ============================================
// 🔧 配置區域 - 在這裡修改後端設置
// ============================================

/**
 * API 配置
 * 
 * 使用方式：
 * 1. 修改 BACKEND_MODE 來切換不同的後端
 * 2. 如果使用 'local-network'，請設置 YOUR_LOCAL_IP
 * 
 * 模式說明：
 * - 'production': 使用 Render.com 生產環境
 * - 'local': 使用 localhost (僅適用於模擬器/瀏覽器)
 * - 'local-network': 使用本地網絡 IP (適用於 Expo Go 在真實設備上)
 */

// 選擇後端模式：'production' | 'local' | 'local-network'
const BACKEND_MODE = 'local-network' as 'production' | 'local' | 'local-network';

// 如果使用 'local-network'，請設置您的本地 IP 地址或 localtunnel URL
// 
// 選項 1: 使用本地 IP 地址
//   Windows: 在 PowerShell 中運行 `ipconfig` 查看 IPv4 地址
//   Mac/Linux: 在終端中運行 `ifconfig` 或 `ip addr` 查看 IP 地址
//   例如: '192.168.1.100'
//
// 選項 2: 使用 localtunnel (推薦用於真實設備測試)
//   1. 安裝: npm install -g localtunnel
//   2. 啟動後端: cd Backend && python manage.py runserver 8000
//   3. 創建 tunnel: lt --port 8000 --subdomain your-subdomain
//   4. 將獲得的 URL (例如: your-subdomain.loca.lt) 填入下方
//   注意: 只需要域名部分，不需要 https:// 前綴
const YOUR_LOCAL_IP = 'coupro-123.loca.lt'; // 替換為您的實際 IP 地址或 localtunnel URL

// ============================================
// 自動配置（不需要修改）
// ============================================

let API_BASE_URL: string;
let BASE_URL: string;

switch (BACKEND_MODE) {
  case 'production':
    // 優先使用環境變數，如果沒有則使用生產環境 URL
    const prodUrl = process.env.EXPO_PUBLIC_API_URL || 'https://coupon-mobile.onrender.com';
    BASE_URL = prodUrl;
    API_BASE_URL = `${prodUrl}/api`;
    break;
  
  case 'local':
    // 使用 localhost（僅適用於模擬器或瀏覽器）
    BASE_URL = 'http://localhost:8000';
    API_BASE_URL = 'http://localhost:8000/api';
    break;
  
  case 'local-network':
    // 使用本地網絡 IP（適用於 Expo Go 在真實設備上）
    // 如果是 tunnel URL (.loca.lt 或 .ngrok)，不需要添加端口
    const isTunnel = YOUR_LOCAL_IP.includes('.loca.lt') || YOUR_LOCAL_IP.includes('.ngrok');
    BASE_URL = isTunnel 
      ? `https://${YOUR_LOCAL_IP}`      // Tunnel：不需要端口
      : `http://${YOUR_LOCAL_IP}:8000`; // 本地 IP：需要端口和 http
    API_BASE_URL = `${BASE_URL}/api`;
    break;
  
  default:
    const defaultUrl = process.env.EXPO_PUBLIC_API_URL || 'https://coupon-mobile.onrender.com';
    BASE_URL = defaultUrl;
    API_BASE_URL = `${defaultUrl}/api`;
}

// 導出用於調試
export const getApiConfig = () => ({
  mode: BACKEND_MODE,
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
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    tokenStorage.access_token = accessToken;
    tokenStorage.refresh_token = refreshToken;
    console.log('[Storage] Loaded tokens from AsyncStorage:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });
  } catch (e) {
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
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    console.log('[Storage] Tokens saved to AsyncStorage');
  } catch (e) {
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
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (e) {
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

// Token refresh state
let isRefreshing = false;
let refreshSubscribers: Array<(success: boolean) => void> = [];

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

export const fetchAPI = async (
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const { requireAuth = true, ...fetchOptions } = options;
  
  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Add auth token if required
  if (requireAuth && !isPublicEndpoint(endpoint)) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
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
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          response = await fetch(url, {
            ...fetchOptions,
            headers,
          });
          
          // If retry still returns 401, authentication has failed
          if (response.status === 401) {
            console.log('[API] Retry after refresh still returned 401, authentication failed');
            await clearTokens();
            throw new AuthenticationError('Authentication failed after token refresh. Please log in again.');
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

// Helper function to parse JSON response
export const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch (e) {
      // If response is not JSON, try to get text
      const text = await response.text().catch(() => 'Unknown error');
      errorData = { error: text || `HTTP ${response.status}` };
    }
    
    console.error('[API] Response error:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
    });
    
    // Extract error message from various possible formats
    // Handle Django REST Framework error format
    if (typeof errorData === 'object' && errorData !== null) {
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
        throw new Error(fieldErrors.join('\n'));
      }
      
      // Check for general error fields
      const errorMessage = 
        errorData.error || 
        errorData.message || 
        errorData.detail ||
        errorData.non_field_errors?.[0] ||
        `HTTP ${response.status}: ${response.statusText}`;
      
      throw new Error(errorMessage);
    }
    
    // If errorData is a string
    if (typeof errorData === 'string') {
      throw new Error(errorData);
    }
    
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

// Auth API functions
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await fetchAPI('/login/', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify({ email, password }),
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
    contact_person: string;
    contact_info?: string;
    store_name: string;
    store_address: string;
    store_lat: number;
    store_lng: number;
    business_hours?: string;
  }) => {
    const response = await fetchAPI('/register/', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify(formData),
    });
    return parseResponse(response);
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

  getUserInfo: async () => {
    const response = await fetchAPI('/user-info/');
    return parseResponse(response);
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
  getProfile: async () => {
    const response = await fetchAPI('/merchant/profile/');
    return parseResponse(response);
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

  getStatistics: async () => {
    const response = await fetchAPI('/merchant/statistics/');
    return parseResponse(response);
  },

  getTemplateAnalytics: async (templateId: number, days: number = 30) => {
    const response = await fetchAPI(`/merchant/coupon-templates/${templateId}/analytics/?days=${days}`);
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

  updateTemplate: async (id: number, data: Partial<{
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
  }>) => {
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
    return parseResponse<Array<{id: number, name: string, display_name: string}>>(response);
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
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
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
    const result = await parseResponse(response);
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

