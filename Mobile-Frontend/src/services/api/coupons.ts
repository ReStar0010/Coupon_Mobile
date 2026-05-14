import { apiClient } from './client';
import { normalizeError } from './errors';

/** FE-shaped projection from the BE GET /api/coupons/ list endpoint. */
export interface Coupon {
  id: string;
  store: string;
  detail: string;
  expires: string; // 'MM/DD' formatted by BE
  amount: number;
  status: 'active' | 'redeemed' | 'expired' | 'shared';
}

export interface RedeemResponse {
  message: string;
  coupon_name: string;
  coupon_detail: string;
  savings_amount: number;
  redeemed_at: string;
  redemption_id: number;
}

export interface ShareResponse {
  share_link: string;
  token: string;
}

export interface ReceiveResponse {
  message: string;
  coupon_id: number;
  coupon_name: string;
  template_id: number;
  remaining_quantity: number;
  acquisition_method: string;
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

/** Redeem a coupon by submitting its redeem code (or a unified store code). */
export async function redeemCoupon(id: string, redeemCode: string): Promise<RedeemResponse> {
  try {
    const response = await apiClient.post<RedeemResponse>(`/api/coupons/${id}/redeem/`, {
      redeem_code: redeemCode,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/** Create a private share request to a phone number. */
export async function shareCoupon(id: string, recipientPhone: string): Promise<ShareResponse> {
  try {
    const response = await apiClient.post<ShareResponse>(`/api/coupons/${id}/share/`, {
      to_phone_number: recipientPhone,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/** Release a coupon to the public CouMap pool. */
export async function shareCouponPublic(id: string, msg?: string): Promise<ShareResponse> {
  try {
    const response = await apiClient.post<ShareResponse>(`/api/coupon/${id}/share-public/`, {
      message: msg ?? '',
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/** Scan-to-receive: claim a coupon by scanning a merchant table QR. */
export async function receiveCoupon(
  qrToken: string,
  idempotencyKey?: string,
): Promise<ReceiveResponse> {
  try {
    const response = await apiClient.post<ReceiveResponse>('/api/coupon/receive/', {
      qrToken,
      idempotencyKey,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}
