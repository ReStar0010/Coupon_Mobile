/**
 * API and Authentication utilities
 * Combines functionality from api.ts and auth.ts into a single, cohesive module
 */

"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../components/providers/SessionProvider";
import { devLog, devDebug } from "./devLogger";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

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
  refreshSubscribers.forEach(callback => callback(token));
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
  
  return publicEndpoints.some(publicPath => endpoint.startsWith(publicPath));
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
      return new Promise<boolean>(resolve => {
        subscribeToRefresh(resolve);
      });
    }
    
    isRefreshing = true;
    
    // The refresh token is stored as an HTTP-only cookie, so we don't need to send it explicitly
    const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const success = response.ok;
    
    // Notify subscribers and reset state
    isRefreshing = false;
    onRefreshComplete(success);
    
    if (!success) {
      return false;
    }
    
    // The backend will automatically set the new tokens as cookies
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
  // Ensure each request includes credentials for cookies
  const axiosOptions: AxiosRequestConfig = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
            const retryResponse = await axios(`${API_BASE_URL}${endpoint}`, axiosOptions);
            return retryResponse;
          } catch (retryError) {
            // If we still have auth issues after refresh, redirect to login
            if (axios.isAxiosError(retryError) && retryError.response?.status === 401) {
              devLog('Authentication failed after token refresh, redirecting to login');
              
              // Use window.location for redirecting since we're not in a React component
              if (typeof window !== 'undefined') {
                window.location.href = '/Login';
              }
              
              const errorData = retryError.response?.data || {};
              const error = new Error(
                errorData.error || errorData.message || `Authentication failed: ${retryError.response?.status}`
              );
              throw error;
            }
            throw retryError;
          }
        } else {
          // If refresh failed, redirect to login
          devLog('Token refresh failed, redirecting to login');
          if (typeof window !== 'undefined') {
            window.location.href = '/Login';
          }
          
          const errorData = error.response?.data || {};
          const authError = new Error(
            errorData.error || errorData.message || `Authentication failed: ${error.response?.status}`
          );
          throw authError;
        }
      }
      
      // Handle other error responses
      const errorData = axios.isAxiosError(error) ? (error.response?.data || {}) : {};
      const apiError = new Error(
        errorData.error || errorData.message || `API request failed: ${axios.isAxiosError(error) ? error.response?.status : 'Unknown error'}`
      );
      throw apiError;
    }
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

/**
 * Get the JWT auth token from cookies
 * @returns The token string or null if not found
 */
export const getRefreshToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith('refresh_token=')) {
      return cookie.substring('refresh_token='.length, cookie.length);
    }
  }
  return null;
};

/**
 * Check if user is logged in
 * @returns boolean indicating login status
 */
export const isUserLoggedIn = (): boolean => {
  if (typeof document === 'undefined') return false;
  
  // More robust cookie checking - parse cookies properly
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith('is_logged_in=')) {
      return cookie.substring('is_logged_in='.length) === 'true';
    }
  }
  
  // Check if auth_token exists as a fallback
  if (getRefreshToken()) {
    return true;
  }
  
  return false;
};

/**
 * Get the current user ID from cookies
 * @returns User ID or null if not found
 */
export const getUserId = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/user_id=([^;]+)/);
  return match ? match[1] : null;
};

/**
 * Hook to protect routes that require authentication
 * Redirects to login page if user is not authenticated
 * If there is a share token in the URL, it will be preserved when redirecting to login
 */
export const useRequireAuth = () => {
  const { isAuthenticated, loading, userId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareToken = searchParams.get("token");

  useEffect(() => {
    // Check if we have cookies directly as a failsafe
    const hasRefreshToken = getRefreshToken() !== null;
    const hasAuth = isAuthenticated || hasRefreshToken;
    
    devDebug('Route protection check:', { 
      isAuthenticated, 
      loading, 
      userId,
      hasRefreshToken,
      cookies: document.cookie,
      shareToken
    });
    
    // If there's a share token, we don't redirect immediately
    // Gift component will handle the redirect after they click "領取"
    if (shareToken) {
      devLog('Share token detected, allowing access for gift viewing');
      return;
    }
    
    // Only redirect if authentication check is complete and user is not authenticated
    // Add a small delay to ensure all auth checks are complete
    const timer = setTimeout(() => {
      if (!loading && !hasAuth) {
        devLog('Redirecting to login due to failed auth');
        router.push("/Login");
      }
    }, 500); // Small delay to ensure all auth checks complete
    
    return () => clearTimeout(timer);
  }, [isAuthenticated, loading, router, userId, shareToken]);

  return { isAuthenticated, loading };
};

/**
 * Logs out the user by calling the logout API and clearing cookies
 */
export const logout = async (): Promise<void> => {  
  try {
    await fetchAPI('/logout/', {method: 'POST', withCredentials: true})
  } catch (error) {
    console.error('Logout failed:', error);
    // Manually clear cookies on client side as fallback
    document.cookie = 'is_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
  
  // Redirect to login page
  window.location.href = '/Login';
};