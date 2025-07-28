// Custom hook for managing coupons
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ApiCoupon, CouponType } from '../utils/types';
import { transformApiCoupon } from '../utils/couponUtils';
import { devDebug } from '../../utils/devLogger';
import { fetchAPI } from '../../utils/authAPI';

export function useCoupons(isAuthenticated: boolean, authLoading: boolean) {
  const [coupons, setCoupons] = useState<CouponType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch coupons from API
  const fetchCoupons = useCallback(async () => {
    // Only fetch coupons if authenticated
    if (authLoading || !isAuthenticated) return;

    setIsLoading(true);
    setError(null);
    try {

      const response = await fetchAPI('/exclusive-coupons/', {method: 'GET', withCredentials: true});
      devDebug("API response:", response.data);

      if (!Array.isArray(response.data)) {
        console.error("API response is not an array:", response.data);
        throw new Error("Unexpected API response format.");
      }
      
      // Transform API data to frontend format
      const transformedCoupons = response.data.map((coupon: ApiCoupon) => transformApiCoupon(coupon)); 
      setCoupons(transformedCoupons);

    } catch (err) {
      console.error("Error fetching coupons:", err);
      let errorMessage = "無法載入優惠券，請稍後再試。";
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          errorMessage = "請先登入或重新登入。";
        } else if (err.message) {
          errorMessage = `無法載入優惠券: ${err.message}`;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setCoupons([]);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  // Load coupons when authenticated
  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  return {
    coupons,
    isLoading,
    error,
    fetchCoupons
  };
}
export default useCoupons;