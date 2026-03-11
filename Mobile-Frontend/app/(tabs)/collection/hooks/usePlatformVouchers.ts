import { useState, useEffect, useCallback } from 'react';
import type { PlatformVoucherListItem } from '@/app/utils/authAPI';
import { platformVoucherAPI } from '@/app/utils/authAPI';

interface UsePlatformVouchersReturn {
  vouchers: PlatformVoucherListItem[];
  isLoading: boolean;
  error: string | null;
  fetchVouchers: () => Promise<void>;
}

export function usePlatformVouchers(
  isAuthenticated: boolean,
  authLoading: boolean,
): UsePlatformVouchersReturn {
  const [vouchers, setVouchers] = useState<PlatformVoucherListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVouchers = useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await platformVoucherAPI.list();
      setVouchers(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error('Error fetching platform vouchers:', err);
      const message =
        err && typeof (err as { response?: { data?: { error?: string } } })?.response?.data?.error === 'string'
          ? (err as { response: { data: { error: string } } }).response.data.error
          : '無法載入現金券，請稍後再試。';
      setError(message);
      setVouchers([]);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchVouchers();
    }
  }, [isAuthenticated, authLoading, fetchVouchers]);

  return {
    vouchers,
    isLoading,
    error,
    fetchVouchers,
  };
}

export default usePlatformVouchers;
