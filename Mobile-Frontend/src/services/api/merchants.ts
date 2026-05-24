import { apiClient } from './client';
import { normalizeError } from './errors';

export interface Merchant {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  verified: boolean;
  logoUrl: string | null;
  /** distance in km from the query lat/lng (only present on /nearby/ results) */
  distanceKm?: number;
  /** held-exclusive + public-shared coupon count at this store (nearby only) */
  couponCount?: number;
  /** true when other users have shared coupons at this store (nearby only) */
  hasSharedCoupons?: boolean;
}

export interface MerchantCoupon {
  id: string;
  label: string;
  detail: string;
  expires: string;
  amount: number;
}

export interface SharedCouponSummary {
  store: string;
  amount: number;
  sharer: string;
  msg: string;
  label: string;
}

export interface MerchantNewsItem {
  id: number;
  author: string;
  agoText: string;
  body: string;
  createdAt: string;
}

/** Bottom-sheet data shape — Merchant + the list sections. */
export interface MerchantDetail extends Merchant {
  myCoupons: MerchantCoupon[];
  sharedCoupons: SharedCouponSummary[];
  /**
   * The current user's own outstanding public shares at this store.
   * Rendered as a read-only section in the sheet (can't be claimed —
   * backend blocks self-claim). Optional for forward compatibility with
   * older BE versions that don't yet send this field.
   */
  myPublicShares?: SharedCouponSummary[];
  news: MerchantNewsItem[];
}

export async function listNearby(
  lat: number,
  lng: number,
  radius?: number,
): Promise<Merchant[]> {
  try {
    const params: Record<string, string | number> = { lat, lng };
    if (radius !== undefined) {
      params.radius = radius;
    }
    const response = await apiClient.get<Merchant[]>('/api/merchants/nearby/', { params });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getMerchant(id: string): Promise<MerchantDetail> {
  try {
    const response = await apiClient.get<MerchantDetail>(`/api/merchants/${id}/`);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/** UGC compliance: report a store. `reason` ∈ {inappropriate, misleading, illegal, spam, other}. */
export async function flagMerchant(id: string, reason: string, details = ''): Promise<void> {
  try {
    await apiClient.post(`/api/merchants/${id}/flag/`, { reason, details });
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function blockMerchant(id: string): Promise<void> {
  try {
    await apiClient.post(`/api/merchants/${id}/block/`);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getBlockedMerchants(): Promise<Merchant[]> {
  try {
    const response = await apiClient.get<Merchant[]>('/api/merchants/blocked/');
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function unblockMerchant(id: string): Promise<void> {
  try {
    await apiClient.delete(`/api/merchants/${id}/block/`);
  } catch (error) {
    throw normalizeError(error);
  }
}
