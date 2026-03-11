import { useState, useEffect, useCallback, useRef } from 'react';
import { isCancel } from 'axios';
import { ApiCoupon, CouponType } from '@/app/(tabs)/collection/utils/types';
import { transformApiCoupon } from '@/app/(tabs)/collection/utils/couponUtils';
import { devDebug } from '@/app/utils/devLogger';
import { fetchAPI } from '@/app/utils/authAPI';
import { useApiError } from '@/app/hooks/useApiError';

interface UseCouponsReturn {
  coupons: CouponType[];
  isLoading: boolean;
  error: string | null;
  fetchCoupons: () => Promise<void>;
}

export function useCoupons(isAuthenticated: boolean, authLoading: boolean): UseCouponsReturn {
  const { getErrorMessage } = useApiError();
  const [coupons, setCoupons] = useState<CouponType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCoupons = useCallback(async () => {
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
      const response = await fetchAPI('/exclusive-coupons/', {
        method: 'GET',
        withCredentials: true,
        signal: abortControllerRef.current.signal,
      });

      if (!isMountedRef.current) return;

      devDebug('API response:', response.data);

      if (!Array.isArray(response.data)) {
        console.error('API response is not an array:', response.data);
        throw new Error('Unexpected API response format.');
      }

      const transformedCoupons = response.data.map((coupon: ApiCoupon) =>
        transformApiCoupon(coupon),
      );

      if (isMountedRef.current) {
        setCoupons(transformedCoupons);
      }
    } catch (err) {
      if (isCancel(err)) {
        devDebug('Request cancelled');
        return;
      }
      console.error('Error fetching coupons:', err);
      if (isMountedRef.current) {
        const errorMessage = getErrorMessage(err);
        // NETWORK_ERROR and auth-related messages are still shown; filter only if we want to hide 401
        const isAuthError =
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { status?: number } }).response?.status === 401;
        if (!isAuthError && errorMessage) {
          setError(errorMessage);
          setCoupons([]);
        }
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
      fetchCoupons();
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isAuthenticated, authLoading, fetchCoupons]);

  return {
    coupons,
    isLoading,
    error,
    fetchCoupons,
  };
}

export default useCoupons;
