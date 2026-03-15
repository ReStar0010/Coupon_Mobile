// Custom hook for handling shared coupons
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ShareRequestInfo } from '@/app/(tabs)/collection/utils/types';
import { devDebug, devLog } from '@/app/utils/devLogger';
import { fetchAPI } from '@/app/utils/authAPI';

export function useSharedCoupon(fetchCouponsCallback: () => void) {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const shareToken = searchParams.token as string;
  const shareType = searchParams.shareType as string;

  const [sharedCoupon, setSharedCoupon] = useState<ShareRequestInfo | null>(null);
  const [showSharedGift, setShowSharedGift] = useState(false);

  // Only handle coupon share when token is present and not a voucher share (mutually exclusive)
  const isCouponShare = !!shareToken && shareType !== 'voucher';

  useEffect(() => {
    if (isCouponShare) {
      fetchShareRequest(shareToken);
    } else {
      setShowSharedGift(false);
      setSharedCoupon(null);
    }
  }, [isCouponShare, shareToken]);

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

      // Filter out 401 authentication errors - they are handled silently by AuthOrchestrator
      // For share tokens, we don't want to show errors or placeholders
      // The AuthOrchestrator will handle redirecting to login if needed
      if (err.response?.status === 401) {
        devLog('User not authenticated for share request - AuthOrchestrator will handle redirect');
        // Don't show any UI, let AuthOrchestrator handle it silently
        setShowSharedGift(false);
        setSharedCoupon(null);
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
      router.replace('/(tabs)/collection');
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
