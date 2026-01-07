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
 * Clear all stored tokens from AsyncStorage
 */
const clearStoredTokens = async (): Promise<void> => {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'is_logged_in', 'user_id']);
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
 * @param loginResponse The response data from login API
 */
export const storeLoginData = async (loginResponse: any, email: string): Promise<void> => {
  try {
    devLog('📦 Storing login data:', loginResponse);

    // Store tokens if they exist
    if (loginResponse.access_token || loginResponse.access) {
      const accessToken = loginResponse.access_token || loginResponse.access;
      await AsyncStorage.setItem('access_token', accessToken);
      devLog('✅ Stored access_token');
    } else {
      devLog('⚠️ No access_token in response - this might cause auth issues');
    }
    //
    if (loginResponse.refresh_token || loginResponse.refresh) {
      const refreshToken = loginResponse.refresh_token || loginResponse.refresh;
      await AsyncStorage.setItem('refresh_token', refreshToken);
      devLog('✅ Stored refresh_token');
    } else {
      devLog('⚠️ No refresh_token in response - this might cause auth issues');
    }

    // Store user ID
    if (loginResponse.user_id) {
      await AsyncStorage.setItem('user_id', loginResponse.user_id.toString());
      devLog('✅ Stored user_id:', loginResponse.user_id);
    }

    // Mark user as logged in (this is crucial for isUserLoggedIn to work)
    await AsyncStorage.setItem('is_logged_in', 'true');
    devLog('✅ Marked user as logged in');

    // Store email for reference
    if(email){
      await AsyncStorage.setItem('email', email);
      devLog('✅ Stored user email:', email);
    }

    // Debug: Verify what was stored
    const storedData = {
      access_token: await AsyncStorage.getItem('access_token'),
      refresh_token: await AsyncStorage.getItem('refresh_token'),
      user_id: await AsyncStorage.getItem('user_id'),
      is_logged_in: await AsyncStorage.getItem('is_logged_in'),
      email: await AsyncStorage.getItem('email'),
    };
    devDebug('📦 Verification - Stored data:', storedData);

    // Check login status after storing
    const loginCheck = await isUserLoggedIn();
    devLog('🔍 Login status check after storing:', loginCheck);
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
 * @returns boolean indicating login status
 */
export const isUserLoggedIn = async (): Promise<boolean> => {
  try {
    const isLoggedIn = await AsyncStorage.getItem('is_logged_in');
    const refreshToken = await AsyncStorage.getItem('refresh_token');

    return isLoggedIn === 'true' || refreshToken !== null;
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
};

/**
 * Get the current user ID from AsyncStorage
 * @returns User ID or null if not found
 */
export const getUserId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('user_id');
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
};

/**
 * Hook to protect routes that require authentication
 * Redirects to login page if user is not authenticated
 * If there is a share token in the URL, it will be preserved when redirecting to login
 */
export const useRequireAuth = () => {
  const { isAuthenticated, loading, userId } = useAuth();
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
      // No delay needed - if loading is false and isAuthenticated is false, redirect immediately
      if (!loading && !isAuthenticated) {
        // Double-check with a quick token check as failsafe
        const hasRefreshToken = (await getRefreshToken()) !== null;
        
        devDebug('Route protection check:', {
          isAuthenticated,
          loading,
          userId,
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
  }, [isAuthenticated, loading, router, userId, shareToken]);

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

export default {
  fetchAPI,
  authAPI,
  refreshAccessToken,
  getRefreshToken,
  getAccessToken,
  isUserLoggedIn,
  getUserId,
  useRequireAuth,
  logout,
  storeLoginData,
  subscribeToRefresh,
  onRefreshComplete,
  isPublicEndpoint,
  clearStoredTokens,
};
