import { apiClient } from './client';
import { normalizeError } from './errors';

export interface Coupon {
  id: string;
  store: string;
  detail: string;
  expires: string; // ISO date
  amount: number;
  status: 'active' | 'redeemed' | 'expired' | 'shared';
  tier: 'bronze' | 'silver' | 'gold';
}

export async function listMyCoupons(): Promise<Coupon[]> {
  try {
    const response = await apiClient.get<Coupon[]>('/api/coupons/');
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getCoupon(id: string): Promise<Coupon> {
  try {
    const response = await apiClient.get<Coupon>(`/api/coupons/${id}/`);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function redeemCoupon(id: string): Promise<Coupon> {
  try {
    const response = await apiClient.post<Coupon>(`/api/coupons/${id}/redeem/`);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function shareCoupon(id: string, recipientPhone: string): Promise<Coupon> {
  try {
    const response = await apiClient.post<Coupon>(`/api/coupons/${id}/share/`, {
      recipientPhone,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}
