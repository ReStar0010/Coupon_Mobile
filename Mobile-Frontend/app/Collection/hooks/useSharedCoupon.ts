// Custom hook for handling shared coupons
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ShareRequestInfo } from '../utils/types';
import { devDebug, devLog } from '../../utils/devLogger';
import { fetchAPI } from '../../utils/authAPI';

export function useSharedCoupon(fetchCouponsCallback: () => void) {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const shareToken = searchParams.token as string;

  const [sharedCoupon, setSharedCoupon] = useState<ShareRequestInfo | null>(null);
  const [showSharedGift, setShowSharedGift] = useState(false);

  // Check if there's a share token in the URL
  useEffect(() => {
    if (shareToken) {
      fetchShareRequest(shareToken);
    } else {
      // Clear shared gift state if no token in URL
      setShowSharedGift(false);
      setSharedCoupon(null);
    }
  }, [shareToken]);

  // Fetch share request details if token is present
  const fetchShareRequest = async (token: string) => {
    try {
      const response = await fetchAPI(`/coupon/share/${token}/`, {
        method: 'GET',
      });

      devDebug('Share request data:', response.data);

      // Only show gift if status is pending
      if (response.data && response.data.status === 'pending') {
        setSharedCoupon(response.data);
        setShowSharedGift(true);
      } else {
        // If not pending, don't show the gift
        setShowSharedGift(false);
      }
    } catch (err: any) {
      console.error('Error fetching share request:', err);

      // If the error is 401 Unauthorized, it means the user is not logged in
      // We'll still show a placeholder gift card that will redirect to login
      if (err.response?.status === 401) {
        devLog('User not authenticated, showing placeholder gift');
        setSharedCoupon({
          coupon_id: 0,
          coupon_name: '請先登入以查看優惠券',
          from_user_email: '未知用戶',
          status: 'pending',
        });
        setShowSharedGift(true);
      } else {
        // For other errors, don't show the gift
        setShowSharedGift(false);
        setSharedCoupon(null);
      }
    }
  };

  // Handle when a gift is accepted
  const handleGiftAccepted = useCallback(() => {
    // Hide the gift UI
    setShowSharedGift(false);
    setSharedCoupon(null);

    // Clean up the URL by removing the token parameter
    if (shareToken) {
      router.replace('/Collection');
    }

    // Refresh coupon list to show the newly acquired coupon
    fetchCouponsCallback();
  }, [shareToken, router, fetchCouponsCallback]);

  return {
    shareToken,
    sharedCoupon,
    showSharedGift,
    handleGiftAccepted,
  };
}
export default useSharedCoupon;
