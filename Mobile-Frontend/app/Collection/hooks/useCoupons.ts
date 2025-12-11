import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { ApiCoupon, CouponType } from '../utils/types';
import { transformApiCoupon } from '../utils/couponUtils';
import { devDebug } from '../../utils/devLogger';
import { fetchAPI } from '../../utils/authAPI';

interface UseCouponsReturn {
  coupons: CouponType[];
  isLoading: boolean;
  error: string | null;
  fetchCoupons: () => Promise<void>;
}

export function useCoupons(
  isAuthenticated: boolean,
  authLoading: boolean
): UseCouponsReturn {
  const [coupons, setCoupons] = useState<CouponType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getErrorMessage = useCallback((err: unknown): string => {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) {
        return '請先登入或重新登入。';
      }
      if (err.message) {
        return `無法載入優惠券: ${err.message}`;
      }
    }
    if (err instanceof Error) {
      return err.message;
    }
    return '無法載入優惠券，請稍後再試。';
  }, []);

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
        transformApiCoupon(coupon)
      );

      if (isMountedRef.current) {
        setCoupons(transformedCoupons);
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        devDebug('Request cancelled');
        return;
      }
      console.error('Error fetching coupons:', err);
      if (isMountedRef.current) {
        setError(getErrorMessage(err));
        setCoupons([]);
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
