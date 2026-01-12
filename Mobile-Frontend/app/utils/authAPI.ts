/**
 * API and Authentication utilities
 * Combines functionality from api.ts and auth.ts into a single, cohesive module
 */

import React, { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../components/providers/SessionProvider';
import { devLog, devDebug } from './devLogger';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';

const API_BASE_URL = API_URL;

// Token refresh state
let isRefreshing = false;
let refreshSubscribers: Array<(token: boolean) => void> = [];

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
  ];

  return publicEndpoints.some((publicPath) => endpoint.startsWith(publicPath));
};

/**
 * Refresh the access token using the refresh token
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

    // Get refresh token from AsyncStorage
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    if (!refreshToken) {
      isRefreshing = false;
      onRefreshComplete(false);
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    const success = response.ok;

    // Notify subscribers and reset state
    isRefreshing = false;
    onRefreshComplete(success);

    if (!success) {
      return false;
    }

    // Store the new tokens in AsyncStorage
    const data = await response.json();
    if (data.access) {
      await AsyncStorage.setItem('access_token', data.access);
    }
    if (data.refresh) {
      await AsyncStorage.setItem('refresh_token', data.refresh);
    }

    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    isRefreshing = false;
    onRefreshComplete(false);
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
 * @returns Promise<boolean> - true if user has valid auth, false if needs to login
 */
export const ensureValidAuth = async (): Promise<boolean> => {
  try {
    const refreshToken = await AsyncStorage.getItem('refresh_token');

    // No refresh token = not logged in
    if (!refreshToken) {
      devLog('No refresh token found - user needs to login');
      return false;
    }

    // Proactively refresh the access token
    // This ensures we have a fresh token before making any API calls
    devLog('Proactively refreshing access token on app startup...');
    const refreshSuccess = await refreshAccessToken();

    if (!refreshSuccess) {
      devLog('Token refresh failed - clearing auth data');
      await clearStoredTokens();
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
  // Get access token from AsyncStorage
  const accessToken = await AsyncStorage.getItem('access_token');

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
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        devLog('Access token expired, attempting to refresh...');

        // Try to refresh the token
        const refreshSuccessful = await refreshAccessToken();

        if (refreshSuccessful) {
          // If refresh successful, retry the original request
          devLog('Token refresh successful, retrying original request');
          try {
            // Get the new access token
            const newAccessToken = await AsyncStorage.getItem('access_token');
            const retryOptions = {
              ...axiosOptions,
              headers: {
                ...axiosOptions.headers,
                Authorization: `Bearer ${newAccessToken}`,
              },
            };

            const retryResponse = await axios(`${API_BASE_URL}${endpoint}`, retryOptions);
            return retryResponse;
          } catch (retryError) {
            // If we still have auth issues after refresh, redirect to login
            if (axios.isAxiosError(retryError) && retryError.response?.status === 401) {
              devLog('Authentication failed after token refresh, redirecting to login');

              // Clear all stored tokens
              await clearStoredTokens();

              const errorData = retryError.response?.data || {};
              const error = new Error(
                errorData.error ||
                  errorData.message ||
                  `Authentication failed: ${retryError.response?.status}`
              );
              throw error;
            }
            throw retryError;
          }
        } else {
          // If refresh failed, redirect to login
          devLog('Token refresh failed, redirecting to login');
          await clearStoredTokens();

          const errorData = error.response?.data || {};
          const authError = new Error(
            errorData.error ||
              errorData.message ||
              `Authentication failed: ${error.response?.status}`
          );
          throw authError;
        }
      }

      // Handle other error responses
      const errorData = axios.isAxiosError(error) ? error.response?.data || {} : {};
      const apiError = new Error(
        errorData.error ||
          errorData.message ||
          `API request failed: ${axios.isAxiosError(error) ? error.response?.status : 'Unknown error'}`
      );
      throw apiError;
    }
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

/**
 * Clear all stored auth data from AsyncStorage
 * Also cleans up legacy keys for backwards compatibility
 */
const clearStoredTokens = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    'access_token',
    'refresh_token',
    // Legacy keys - kept for cleanup of old data
    'user_id',
    'email',
    'is_logged_in',
  ]);
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
    devLog('📦 Storing login tokens');

    const accessToken = loginResponse.access_token || loginResponse.access;
    const refreshToken = loginResponse.refresh_token || loginResponse.refresh;

    if (!accessToken || !refreshToken) {
      throw new Error('Invalid login response: missing tokens');
    }

    // Store only essential tokens
    await AsyncStorage.multiSet([
      ['access_token', accessToken],
      ['refresh_token', refreshToken],
    ]);

    devLog('✅ Stored tokens successfully');
  } catch (error) {
    console.error('Error storing login data:', error);
    throw error;
  }
};

/**
 * Get the JWT refresh token from AsyncStorage
 * @returns The token string or null if not found
 */
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('refresh_token');
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
};

/**
 * Get the JWT access token from AsyncStorage
 * @returns The token string or null if not found
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('access_token');
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
};

/**
 * Check if user is logged in
 *
 * Uses refresh_token presence as single source of truth.
 * This avoids inconsistencies from redundant flags.
 *
 * @returns boolean indicating login status
 */
export const isUserLoggedIn = async (): Promise<boolean> => {
  try {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    return refreshToken !== null && refreshToken.length > 0;
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
};

/**
 * Hook to protect routes that require authentication
 * Redirects to login page if user is not authenticated
 * If there is a share token in the URL, it will be preserved when redirecting to login
 */
export const useRequireAuth = () => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const shareToken = params.token as string;

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      // If there's a share token, we don't redirect immediately
      // Gift component will handle the redirect after they click "領取"
      if (shareToken) {
        devLog('Share token detected, allowing access for gift viewing');
        return;
      }

      // Only redirect if authentication check is complete and user is not authenticated
      if (!loading && !isAuthenticated) {
        // Double-check with a quick token check as failsafe
        const hasRefreshToken = (await getRefreshToken()) !== null;

        devDebug('Route protection check:', {
          isAuthenticated,
          loading,
          hasRefreshToken,
          shareToken,
        });

        if (isMounted && !hasRefreshToken) {
          devLog('Redirecting to login due to failed auth');
          router.push('/Login');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, loading, router, shareToken]);

  // Return isAuthenticated as true if we have a refresh token, even if SessionProvider hasn't finished
  // This allows components to start rendering/fetching earlier
  const [hasToken, setHasToken] = React.useState<boolean | null>(null);
  
  React.useEffect(() => {
    // Quick token check to allow early rendering
    getRefreshToken().then(token => {
      setHasToken(token !== null);
    });
  }, []);

  // If we have a token, we can consider the user authenticated immediately
  // This allows data fetching to start before SessionProvider finishes
  const effectiveIsAuthenticated = isAuthenticated || hasToken === true;
  
  // Only show loading if:
  // 1. SessionProvider is still loading AND
  // 2. We haven't checked for a token yet OR we don't have a token
  // If we have a token, we can proceed even if SessionProvider is still loading
  const effectiveLoading = loading && (hasToken === null || (hasToken === false && !isAuthenticated));

  return { isAuthenticated: effectiveIsAuthenticated, loading: effectiveLoading };
};

/**
 * Logs out the user by calling the logout API and clearing tokens
 */
export const logout = async (): Promise<void> => {
  try {
    await fetchAPI('/logout/', { method: 'POST' });
  } catch (error) {
    console.error('Logout failed:', error);
    // Manually clear tokens on client side as fallback
    await clearStoredTokens();
  }

  // Clear all stored tokens
  await clearStoredTokens();

  // Note: In React Native, we don't use window.location.href
  // The router navigation should be handled by the calling component
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
 * QR Code Claim API functions
 */
export const qrClaimAPI = {
  /**
   * Claim coupon via QR code
   * @param templateId Template ID from QR code
   * @param sessionToken Session token from QR code
   * @returns Claim response
   */
  claimCouponViaQR: async (templateId: number, sessionToken: string): Promise<{
    message: string;
    coupon_id: number;
    coupon_name: string;
    template_id: number;
    remaining_quantity: number;
    acquisition_method: 'qr_claim';
  }> => {
    let lastError: any;
    const maxRetries = 2;
    const retryDelays = [1000, 2000]; // 1s, 2s delays

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchAPI('/qr-claim/claim/', {
          method: 'POST',
          data: {
            template_id: templateId,
            session_token: sessionToken,
          },
        });
        return response.data;
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;
        
        // Don't retry on 4xx errors (client errors)
        if (status >= 400 && status < 500) {
          throw error;
        }
        
        // Retry on network errors (5xx, timeout, network failures)
        if (attempt < maxRetries && (status >= 500 || status === 502 || status === 503 || status === 504 || !status)) {
          const delay = retryDelays[attempt];
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
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
};
