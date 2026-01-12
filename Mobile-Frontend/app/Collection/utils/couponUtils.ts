// Utility functions for Collection page

import { fetchAPI } from '../../utils/authAPI';
import { ApiCoupon, CouponType } from './types';
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

    return response.data.share_link;
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
 * Filter coupons based on search query
 */
export const filterCoupons = (coupons: CouponType[], searchQuery: string): CouponType[] => {
  if (!searchQuery) return coupons;

  const query = searchQuery.toLowerCase().trim();
  return coupons.filter((coupon) => {
    // 搜尋店家名稱
    if (coupon.storeName?.toLowerCase().includes(query)) return true;
    
    // 搜尋優惠內容
    if (coupon.description?.toLowerCase().includes(query)) return true;
    
    // 搜尋優惠名稱
    if (coupon.couponName?.toLowerCase().includes(query)) return true;
    
    // 搜尋標籤
    if (coupon.tags && coupon.tags.length > 0) {
      const tagMatch = coupon.tags.some(tag => 
        tag.toLowerCase().includes(query)
      );
      if (tagMatch) return true;
    }
    
    return false;
  });
};
export default transformApiCoupon;
