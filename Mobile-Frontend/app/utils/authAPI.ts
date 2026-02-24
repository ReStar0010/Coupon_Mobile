/**
 * API and Authentication utilities
 * Combines functionality from api.ts and auth.ts into a single, cohesive module
 *
 * Architecture:
 * - Uses authEvents for centralized auth failure handling
 * - Uses tokenUtils for token storage operations
 * - AuthOrchestrator handles navigation on auth failures
 */

import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../components/providers/SessionProvider';
import { devLog, devDebug } from './devLogger';
import axios, { AxiosRequestConfig, AxiosResponse, isAxiosError } from 'axios';
import { API_URL } from '../config/api';
import { authEvents, AUTH_EVENT_TYPES } from './authEvents';
import {
  getAccessToken,
  getRefreshToken,
  storeTokens,
  clearTokens,
  hasValidRefreshToken,
  initStorage,
} from './tokenUtils';

const API_BASE_URL = API_URL;

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
let refreshSubscribers: ((token: boolean) => void)[] = [];

/**
 * Queued request type for handling concurrent 401 errors
 */
type QueuedRequest = {
  endpoint: string;
  options: AxiosRequestConfig;
  resolve: (value: AxiosResponse) => void;
  reject: (error: any) => void;
};

// Request queue for handling concurrent 401 errors
let requestQueue: QueuedRequest[] = [];

/**
 * Subscribe to the refresh token event
 * @param callback Function to call when token refresh completes
 */
const subscribeToRefresh = (callback: (token: boolean) => void): void => {
  refreshSubscribers.push(callback);
};

/**
 * Notify all subscribers about the token refresh result
 * @param token Success status of the refresh
 */
const onRefreshComplete = (token: boolean): void => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

/**
 * Process queued requests after token refresh
 * @param success Whether the token refresh was successful
 */
const processQueue = async (success: boolean): Promise<void> => {
  if (success) {
    // Get the new access token
    const newAccessToken = getAccessToken();

    // Retry all queued requests with the new token
    const queue = [...requestQueue];
    requestQueue = [];

    devLog(`Processing ${queue.length} queued requests after successful token refresh`);

    for (const queuedRequest of queue) {
      try {
        const retryOptions = {
          ...queuedRequest.options,
          headers: {
            ...queuedRequest.options.headers,
            Authorization: `Bearer ${newAccessToken}`,
          },
        };

        const retryResponse = await axios(`${API_BASE_URL}${queuedRequest.endpoint}`, retryOptions);
        queuedRequest.resolve(retryResponse);
      } catch (retryError) {
        // If retry still fails with 401, it means refresh token is also invalid
        if (isAxiosError(retryError) && retryError.response?.status === 401) {
          devLog('Request still failed after token refresh - refresh token may be invalid');
          // Create a generic error without exposing authentication details
          const genericError = new Error('Request failed');
          queuedRequest.reject(genericError);
        } else {
          // Other errors (network, 400, 404, 500, etc.) should be passed through
          queuedRequest.reject(retryError);
        }
      }
    }
  } else {
    // Token refresh failed - reject all queued requests silently
    // Don't throw authentication errors to avoid showing them in UI
    devLog(`Rejecting ${requestQueue.length} queued requests due to token refresh failure`);

    const queue = [...requestQueue];
    requestQueue = [];

    for (const queuedRequest of queue) {
      // Create a generic error without authentication details
      const genericError = new Error('Request failed');
      queuedRequest.reject(genericError);
    }
  }
};

/**
 * Check if an endpoint is public (doesn't require authentication)
 * @param endpoint API path
 * @returns boolean indicating if the endpoint is public
 */
const isPublicEndpoint = (endpoint: string): boolean => {
  // List of endpoints that don't require authentication
  const publicEndpoints = [
    '/login/',
    '/register/',
    '/verify-email/',
    '/forgot-password/',
    '/reset-password/',
    '/store-coupons/',
    'coupons/<int:id>/',
    'coupon/share/<str:token>/',
    // Phone-based registration (009-phone-registration)
    '/register/send-otp/',
    '/register/verify-otp/',
    // Phone-based password reset (009-phone-registration)
    '/forgot-password/phone/send-otp/',
    '/forgot-password/phone/reset/',
  ];

  return publicEndpoints.some((publicPath) => endpoint.startsWith(publicPath));
};

/**
 * Refresh the access token using the refresh token
 * Emits AUTH_FAILURE event on failure, SESSION_REFRESHED on success
 * @returns Promise with the refresh response
 */
export const refreshAccessToken = async (): Promise<boolean> => {
  try {
    // Only allow one refresh at a time, queue all others
    if (isRefreshing) {
      devLog('Token refresh already in progress, queueing request');
      return new Promise<boolean>((resolve) => {
        subscribeToRefresh(resolve);
      });
    }

    isRefreshing = true;

    // Get refresh token from memory (synchronous after initStorage)
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      devLog('No refresh token found - user needs to login');
      isRefreshing = false;
      onRefreshComplete(false);
      authEvents.emit({
        type: AUTH_EVENT_TYPES.AUTH_FAILURE,
        reason: 'no_refresh_token',
      });
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const success = response.ok;

    // Notify subscribers and reset state
    isRefreshing = false;
    onRefreshComplete(success);

    if (!success) {
      devLog('Token refresh failed - clearing tokens');
      await clearTokens();

      // Process queue before emitting auth failure (will reject all requests silently)
      await processQueue(false);

      authEvents.emit({
        type: AUTH_EVENT_TYPES.AUTH_FAILURE,
        reason: 'refresh_failed',
      });
      return false;
    }

    // Store the new tokens
    const data = await response.json();
    // Handle both response formats: access/refresh and access_token/refresh_token
    const newAccessToken = data.access_token || data.access;
    const newRefreshToken = data.refresh_token || data.refresh || refreshToken;

    if (newAccessToken) {
      await storeTokens(newAccessToken, newRefreshToken);
      devLog('Token refresh successful');

      // Process queue after storing new tokens (will retry all requests)
      await processQueue(true);

      authEvents.emit({ type: AUTH_EVENT_TYPES.SESSION_REFRESHED });
      return true;
    }

    devLog('Token refresh failed - no access token in response');
    isRefreshing = false;
    onRefreshComplete(false);
    await processQueue(false);
    return false;
  } catch (error) {
    console.error('Token refresh error:', error);
    isRefreshing = false;
    onRefreshComplete(false);

    // Process queue before emitting auth failure
    await processQueue(false);

    authEvents.emit({
      type: AUTH_EVENT_TYPES.AUTH_FAILURE,
      reason: 'refresh_error',
    });
    return false;
  }
};

/**
 * Ensure the user has a valid access token on app startup
 *
 * This function should be called when the app initializes to proactively
 * refresh the access token if needed, rather than waiting for a 401 error.
 *
 * Benefits:
 * - Faster first API call (no need to retry after 401)
 * - Better UX (no flash of logged-out state)
 * - Validates that refresh token is still valid
 *
 * Note: This function does NOT emit auth events because it's called at startup
 * before the AuthOrchestrator is mounted. The caller (index.tsx) handles navigation.
 *
 * @returns Promise<boolean> - true if user has valid auth, false if needs to login
 */
export const ensureValidAuth = async (): Promise<boolean> => {
  try {
    // First, load tokens from AsyncStorage into memory
    await initStorage();

    // Check if refresh token exists (synchronous after initStorage)
    const hasToken = hasValidRefreshToken();

    // No refresh token = not logged in
    if (!hasToken) {
      devLog('No refresh token found - user needs to login');
      return false;
    }

    // Proactively refresh the access token
    // This ensures we have a fresh token before making any API calls
    devLog('Proactively refreshing access token on app startup...');

    const refreshSuccess = await refreshAccessToken();

    if (!refreshSuccess) {
      devLog('Token refresh failed at startup');
      // Tokens already cleared by refreshAccessToken
      return false;
    }

    devLog('Access token refreshed successfully');
    return true;
  } catch (error) {
    console.error('Error ensuring valid auth:', error);
    return false;
  }
};

/**
 * Wrapped axios function with authentication and error handling
 * @param endpoint API path (without base URL)
 * @param options axios request options
 * @returns Promise with the axios response
 */
export const fetchAPI = async (
  endpoint: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse> => {
  // Get access token from memory (synchronous after initStorage)
  const accessToken = getAccessToken();

  // Ensure each request includes the access token
  const axiosOptions: AxiosRequestConfig = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    },
  };

  try {
    // Make the initial API request
    try {
      const response = await axios(`${API_BASE_URL}${endpoint}`, axiosOptions);
      // If successful, return the response immediately
      return response;
    } catch (error) {
      // Check if it's a public endpoint
      if (isPublicEndpoint(endpoint)) {
        throw error; // Re-throw the error for public endpoints
      }

      // Check if the error is due to authentication issues
      if (isAxiosError(error) && error.response?.status === 401) {
        devLog('Access token expired, queueing request for retry after token refresh...');

        // Queue the request instead of immediately handling it
        // This allows multiple concurrent 401 errors to be handled efficiently
        return new Promise<AxiosResponse>((resolve, reject) => {
          // Add request to queue
          requestQueue.push({
            endpoint,
            options: axiosOptions,
            resolve,
            reject,
          });

          // Trigger token refresh if not already in progress
          if (!isRefreshing) {
            refreshAccessToken().catch((refreshError) => {
              // Error already handled by refreshAccessToken (processQueue called)
              devLog('Token refresh error in fetchAPI:', refreshError);
            });
          }
          // If refresh is already in progress, the queue will be processed when it completes
        });
      }

      // Handle other error responses
      // Preserve the original error object to maintain response information for retry logic
      if (isAxiosError(error)) {
        // For Axios errors, keep the original error to preserve response data
        const errorData = error.response?.data || {};
        const errorMessage =
          errorData.error || errorData.message || `API request failed: ${error.response?.status}`;
        console.error('API request error:', new Error(errorMessage));
        throw error; // Throw original Axios error to preserve response info
      } else {
        // For non-Axios errors, wrap in a new Error
        const apiError = new Error('API request failed: Unknown error');
        console.error('API request error:', apiError);
        throw apiError;
      }
    }
  } catch (error) {
    // Error already logged in the inner catch block
    throw error;
  }
};

/**
 * Clear all stored auth data from AsyncStorage
 * Uses tokenUtils.clearTokens which also handles legacy keys
 *
 * @param emitEvent Whether to emit AUTH_FAILURE event (default: false)
 */
const clearStoredTokens = async (emitEvent: boolean = false): Promise<void> => {
  await clearTokens();
  if (emitEvent) {
    authEvents.emit({
      type: AUTH_EVENT_TYPES.AUTH_FAILURE,
      reason: 'tokens_cleared',
    });
  }
};

/**
 * API client wrapper that provides post and get methods
 * Returns response.data instead of full AxiosResponse
 */
export const authAPI = {
  /**
   * POST request
   * @param endpoint API endpoint
   * @param data Request body data
   * @returns Response data
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetchAPI(endpoint, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  /**
   * GET request
   * @param endpoint API endpoint
   * @returns Response data
   */
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetchAPI(endpoint, {
      method: 'GET',
    });
    return response.data;
  },

  /**
   * DELETE request
   * @param endpoint API endpoint
   * @returns Response data
   */
  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetchAPI(endpoint, {
      method: 'DELETE',
    });
    return response.data;
  },
};

/**
 * Store login data in AsyncStorage after successful login
 *
 * Minimal JWT storage - only stores essential tokens:
 * - access_token: For API authentication
 * - refresh_token: For refreshing expired access tokens (single source of truth for login status)
 *
 * User info (email, user_id) should be fetched from API when needed.
 *
 * @param loginResponse The response data from login API
 */
export const storeLoginData = async (loginResponse: any): Promise<void> => {
  try {
    devLog('Storing login tokens');

    const accessToken = loginResponse.access_token || loginResponse.access;
    const refreshToken = loginResponse.refresh_token || loginResponse.refresh;

    if (!accessToken || !refreshToken) {
      throw new Error('Invalid login response: missing tokens');
    }

    // Store tokens using tokenUtils
    await storeTokens(accessToken, refreshToken);

    devLog('Stored tokens successfully');

    // Emit session refreshed event to sync auth state
    authEvents.emit({ type: AUTH_EVENT_TYPES.SESSION_REFRESHED });
  } catch (error) {
    console.error('Error storing login data:', error);
    throw error;
  }
};

// Re-export token getters from tokenUtils for backward compatibility
export { getRefreshToken, getAccessToken } from './tokenUtils';

/**
 * Check if user is logged in
 *
 * Uses refresh_token presence as single source of truth.
 * This avoids inconsistencies from redundant flags.
 *
 * @returns boolean indicating login status
 */
export const isUserLoggedIn = hasValidRefreshToken;

/**
 * Hook to protect routes that require authentication
 *
 * Simplified version that trusts SessionProvider as single source of truth.
 * Navigation on auth failure is handled centrally by AuthOrchestrator.
 *
 * Special handling for share tokens (gift viewing) - allows unauthenticated access.
 */
export const useRequireAuth = () => {
  const { isAuthenticated, loading } = useAuth();
  const params = useLocalSearchParams();
  const shareToken = params.token as string;

  // Gift viewing exception - allow unauthenticated access for share tokens
  const allowUnauthenticated = Boolean(shareToken);

  if (allowUnauthenticated) {
    devDebug('Share token detected, allowing access for gift viewing');
  }

  return {
    isAuthenticated: isAuthenticated || allowUnauthenticated,
    loading,
  };
};

/**
 * Logs out the user by calling the logout API and clearing tokens
 *
 * Emits LOGOUT_REQUESTED event for AuthOrchestrator to handle navigation.
 */
export const logout = async (): Promise<void> => {
  try {
    // Best effort - call logout API to invalidate token on server
    await fetchAPI('/logout/', { method: 'POST' });
  } catch (_error) {
    devLog('Logout API call failed, proceeding with local logout');
  }

  // Clear all stored tokens
  await clearTokens();

  // Emit logout event - AuthOrchestrator will handle navigation
  authEvents.emit({ type: AUTH_EVENT_TYPES.LOGOUT_REQUESTED });
};

/**
 * Unified Redemption API functions
 */
export const unifiedRedemptionAPI = {
  /**
   * Validate unified redemption code and get available coupons
   * @param code 6-digit unified redemption code
   * @returns Store info and available coupons
   */
  validateUnifiedRedemptionCode: async (code: string) => {
    const response = await fetchAPI(`/unified-redemption/${code}/`, {
      method: 'GET',
    });
    return response.data;
  },

  /**
   * Redeem coupon with unified redemption code
   * @param couponId Coupon ID to redeem
   * @param unifiedCode Unified redemption code
   * @returns Redemption response
   */
  redeemCouponWithUnifiedCode: async (couponId: number, unifiedCode: string) => {
    const response = await fetchAPI(`/redeem/${couponId}/`, {
      method: 'POST',
      data: { redeem_code: unifiedCode },
    });
    return response.data;
  },
};

/**
 * Generate a unique idempotency key for QR claim operations.
 * One key per claim call so retries within the same call reuse it and avoid duplicate coupons.
 */
function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
}

/**
 * QR Code Claim API functions
 */
export const qrClaimAPI = {
  /**
   * Claim coupon via QR code
   * @param templateId Template ID from QR code
   * @param sessionToken Session token from QR code
   * @returns Claim response
   */
  claimCouponViaQR: async (
    templateId: number,
    sessionToken: string
  ): Promise<{
    message: string;
    coupon_id: number;
    coupon_name: string;
    template_id: number;
    remaining_quantity: number;
    acquisition_method: 'qr_claim';
  }> => {
    const idempotencyKey = generateIdempotencyKey();
    let lastError: any;
    const maxRetries = 2;
    const retryDelays = [1000, 2000];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchAPI('/qr-claim/claim/', {
          method: 'POST',
          data: {
            template_id: templateId,
            session_token: sessionToken,
            idempotency_key: idempotencyKey,
          },
        });
        return response.data;
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;
        if (status >= 400 && status < 500) throw error;
        if (
          attempt < maxRetries &&
          (status >= 500 || status === 502 || status === 503 || status === 504 || !status)
        ) {
          await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  },

  /** Claim by single token (deep link). Backend resolves claim_token to session/template. */
  claimCouponByToken: async (
    claimToken: string
  ): Promise<{
    message: string;
    coupon_id: number;
    coupon_name: string;
    template_id: number;
    remaining_quantity: number;
    acquisition_method: 'qr_claim';
  }> => {
    const idempotencyKey = generateIdempotencyKey();
    const response = await fetchAPI('/qr-claim/claim/', {
      method: 'POST',
      data: {
        claim_token: claimToken,
        idempotency_key: idempotencyKey,
      },
    });
    return response.data;
  },
};

export default {
  fetchAPI,
  authAPI,
  unifiedRedemptionAPI,
  refreshAccessToken,
  ensureValidAuth,
  getRefreshToken,
  getAccessToken,
  isUserLoggedIn,
  useRequireAuth,
  logout,
  storeLoginData,
  subscribeToRefresh,
  onRefreshComplete,
  isPublicEndpoint,
  clearStoredTokens,
  AuthenticationError,
};
