// Utility functions for Collection page

import { fetchAPI } from '../../utils/authAPI';
import { ApiCoupon, CouponType } from './types';
import axios from 'axios';

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
  };
};

/**
 * Generate shareable link for a coupon
 */
export const generateShareLink = async (couponId: number): Promise<string | null> => {
  try {

    const response = await fetchAPI(`/coupon/${couponId}/share/`, {method: 'POST', withCredentials: true}); 

    return response.data.share_link;
  } catch (err: any) {
    console.error("Error sharing coupon:", err);
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
    console.error("Failed to copy to clipboard:", err);
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
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    
    return lastDrawDate === today;
  } catch (err) {
    console.error("Error fetching last draw date:", err);
    // Fallback to localStorage if API fails
    const localLastDrawDate = localStorage.getItem("lastDrawDate");
    const today = new Date().toISOString().split("T")[0];
    return localLastDrawDate === today;
  }
};

/**
 * Filter coupons based on search query
 */
export const filterCoupons = (coupons: CouponType[], searchQuery: string): CouponType[] => {
  if (!searchQuery) return coupons;
  
  const query = searchQuery.toLowerCase();
  return coupons.filter(
    (coupon) =>
      coupon.storeName?.toLowerCase().includes(query) ||
      coupon.description?.toLowerCase().includes(query)
  );
};
