// Custom hook for handling shared platform vouchers (deep link)
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { VoucherShareRequestInfo } from '@/app/(tabs)/collection/utils/types';
import { devDebug, devLog } from '@/app/utils/devLogger';
import { fetchAPI } from '@/app/utils/authAPI';

export function useSharedVoucher(fetchVouchersCallback: () => void) {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const shareToken = searchParams.token as string;
  const shareType = searchParams.shareType as string;

  const [sharedVoucher, setSharedVoucher] = useState<VoucherShareRequestInfo | null>(null);
  const [showSharedVoucher, setShowSharedVoucher] = useState(false);

  const isVoucherShare = shareType === 'voucher' && !!shareToken;

  useEffect(() => {
    if (isVoucherShare) {
      fetchShareRequest(shareToken);
    } else {
      setShowSharedVoucher(false);
      setSharedVoucher(null);
    }
  }, [isVoucherShare, shareToken]);

  const fetchShareRequest = async (token: string) => {
    try {
      const response = await fetchAPI(`/platform-voucher/share/${token}/`, {
        method: 'GET',
      });

      devDebug('Voucher share request data:', response.data);

      if (response.data && response.data.status === 'pending') {
        setSharedVoucher(response.data);
        setShowSharedVoucher(true);
      } else {
        setShowSharedVoucher(false);
      }
    } catch (err: unknown) {
      console.error('Error fetching voucher share request:', err);

      if ((err as { response?: { status?: number } })?.response?.status === 401) {
        devLog(
          'User not authenticated for voucher share request - AuthOrchestrator will handle redirect',
        );
        setShowSharedVoucher(false);
        setSharedVoucher(null);
      } else {
        setShowSharedVoucher(false);
        setSharedVoucher(null);
      }
    }
  };

  const handleVoucherAccepted = useCallback(() => {
    setShowSharedVoucher(false);
    setSharedVoucher(null);

    if (shareToken) {
      router.replace('/(tabs)/collection');
    }

    fetchVouchersCallback();
  }, [shareToken, router, fetchVouchersCallback]);

  return {
    shareToken,
    sharedVoucher,
    showSharedVoucher,
    handleVoucherAccepted,
  };
}

export default useSharedVoucher;
