// Utility functions for Collection page

import { fetchAPI } from '@/app/utils/authAPI';
import { ApiCoupon, CouponType, ExpiryFilter } from './types';
import axios from 'axios';

/**
 * Get display label for acquisition method
 */
export const getAcquisitionMethodLabel = (method?: string): string => {
  const labels: Record<string, string> = {
    'draw': '抽優惠券',
    'consolidate': '電話歸戶',
    'transfer': '私人轉讓',
    'public_pool': '公共池領取',
    'qr_claim': 'QR Code 領取',
  };
  return method ? (labels[method] || method) : '';
};

/**
 * Transform API coupon data to frontend format
 */
export const transformApiCoupon = (coupon: ApiCoupon): CouponType => {
  return {
    id: coupon.id,
    storeName: coupon.store_name,
    couponName: coupon.coupon_name,
    description: coupon.coupon_detail,
    importantNotes: coupon.important_notes,
    startDate: new Date(coupon.start_date),
    expiryDate: new Date(coupon.expiry_date),
    couponType: coupon.coupon_type,
    sourceUser: coupon.current_holder,
    imageUrl: coupon.image_url,
    tags: coupon.tags,
    acquisitionMethod: coupon.acquisition_method,
    storeId: coupon.store_id,
    merchantDeleted: coupon.merchant_deleted || false,
  };
};

/**
 * Generate shareable link for a coupon
 */
export const generateShareLink = async (couponId: number): Promise<string | null> => {
  try {
    const response = await fetchAPI(`/coupon/${couponId}/share/`, {
      method: 'POST',
      withCredentials: true,
    });

    return (response.data.share_link_web ?? response.data.share_link) ?? null;
  } catch (err: any) {
    console.error('Error sharing coupon:', err);
    throw err;
  }
};

/**
 * Attempt to copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // await navigator.clipboard.writeText(text);
    await navigator.share({ text });
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
};

/**
 * Check if the user has already drawn a daily coupon today
 */
export const checkLastDrawDate = async (): Promise<boolean> => {
  try {
    const response = await fetchAPI('/last-draw/', { method: 'GET', withCredentials: true });

    const lastDrawDate = response.data?.last_draw_date;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    return lastDrawDate === today;
  } catch (err) {
    console.error('Error fetching last draw date:', err);
    // Fallback to localStorage if API fails
    const localLastDrawDate = localStorage.getItem('lastDrawDate');
    const today = new Date().toISOString().split('T')[0];
    return localLastDrawDate === today;
  }
};

/**
 * Check if coupon matches expiry filter
 */
const matchesExpiryFilter = (coupon: CouponType, filter: ExpiryFilter): boolean => {
  if (filter === 'all') return true;

  const now = new Date();
  const expiryDate = coupon.expiryDate;
  
  if (!expiryDate) return false;

  // Reset time to start of day for comparison
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  switch (filter) {
    case 'expiringSoon': {
      // 7天内到期
      const sevenDaysFromNow = new Date(todayStart);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const expiryTime = expiryDate.getTime();
      const nowTime = now.getTime();
      const sevenDaysTime = sevenDaysFromNow.getTime();
      return expiryTime > nowTime && expiryTime <= sevenDaysTime;
    }

    case 'thisWeek': {
      // 本周到期（周一到周日）
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - diff);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      const expiryTime = expiryDate.getTime();
      return expiryTime >= weekStart.getTime() && expiryTime < weekEnd.getTime();
    }

    case 'thisMonth': {
      // 本月到期
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      const expiryTime = expiryDate.getTime();
      return expiryTime >= monthStart.getTime() && expiryTime < monthEnd.getTime();
    }

    default:
      return true;
  }
};

/**
 * Filter coupons based on search query and multiple filter criteria
 */
export const filterCoupons = (
  coupons: CouponType[],
  searchQuery: string,
  selectedTags?: string[],
  expiryFilter?: ExpiryFilter,
  selectedMerchant?: string | null
): CouponType[] => {
  return coupons.filter((coupon) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        coupon.storeName?.toLowerCase().includes(query) ||
        coupon.description?.toLowerCase().includes(query) ||
        coupon.couponName?.toLowerCase().includes(query) ||
        (coupon.tags &&
          coupon.tags.some((tag) => tag.toLowerCase().includes(query)));
      
      if (!matchesSearch) return false;
    }

    // Tag filter (multi-select)
    // selectedTags should contain display_names (e.g., "食物", "飲品") to match coupon.tags
    if (selectedTags && selectedTags.length > 0) {
      if (!coupon.tags || coupon.tags.length === 0) return false;
      
      // Check if coupon has at least one of the selected tags
      const hasMatchingTag = selectedTags.some((selectedTag) =>
        coupon.tags!.some((tag) => 
          tag.toLowerCase() === selectedTag.toLowerCase()
        )
      );
      
      if (!hasMatchingTag) return false;
    }

    // Expiry filter
    if (expiryFilter && expiryFilter !== 'all') {
      if (!matchesExpiryFilter(coupon, expiryFilter)) return false;
    }

    // Merchant filter
    if (selectedMerchant) {
      if (coupon.storeName?.toLowerCase() !== selectedMerchant.toLowerCase()) {
        return false;
      }
    }

    return true;
  });
};
export default transformApiCoupon;
