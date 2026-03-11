import { useState, useEffect, useCallback, useRef } from 'react';
import { isAxiosError, isCancel } from 'axios';
import { devDebug } from '@/app/utils/devLogger';
import { fetchAPI } from '@/app/utils/authAPI';

export interface PublicShare {
  share_id: number;
  coupon_id: number;
  coupon_name: string;
  store_name: string | null;
  image_url: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
}

interface UseMyPublicSharesReturn {
  publicShares: PublicShare[];
  isLoading: boolean;
  error: string | null;
  fetchPublicShares: () => Promise<void>;
}

export function useMyPublicShares(
  isAuthenticated: boolean,
  authLoading: boolean,
): UseMyPublicSharesReturn {
  const [publicShares, setPublicShares] = useState<PublicShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getErrorMessage = useCallback((err: unknown): string => {
    if (isAxiosError(err)) {
      // Filter out 401 authentication errors - they are handled silently by AuthOrchestrator
      if (err.response?.status === 401) {
        return ''; // Return empty string to prevent UI from displaying auth errors
      }
      if (err.message) {
        return `無法載入分享記錄: ${err.message}`;
      }
    }
    if (err instanceof Error) {
      // Also check error message for authentication-related errors
      if (err.message.includes('Authentication') || err.message.includes('401')) {
        return ''; // Filter authentication errors
      }
      return err.message;
    }
    return '無法載入分享記錄，請稍後再試。';
  }, []);

  const fetchPublicShares = useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchAPI('/my-public-shares/', {
        method: 'GET',
        withCredentials: true,
        signal: abortControllerRef.current.signal,
      });

      if (!isMountedRef.current) return;

      devDebug('Public shares response:', response.data);

      if (!Array.isArray(response.data)) {
        console.error('API response is not an array:', response.data);
        throw new Error('Unexpected API response format.');
      }

      if (isMountedRef.current) {
        setPublicShares(response.data);
      }
    } catch (err) {
      if (isCancel(err)) {
        devDebug('Request cancelled');
        return;
      }
      console.error('Error fetching public shares:', err);
      if (isMountedRef.current) {
        const errorMessage = getErrorMessage(err);
        // Only set error if it's not empty (i.e., not a 401 auth error)
        if (errorMessage) {
          setError(errorMessage);
          setPublicShares([]);
        }
        // For 401 errors, silently let AuthOrchestrator handle the redirect
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [authLoading, isAuthenticated, getErrorMessage]);

  useEffect(() => {
    isMountedRef.current = true;

    if (isAuthenticated && !authLoading) {
      fetchPublicShares();
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isAuthenticated, authLoading, fetchPublicShares]);

  return {
    publicShares,
    isLoading,
    error,
    fetchPublicShares,
  };
}

export default useMyPublicShares;
