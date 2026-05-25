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
  gem_reward: number;
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
  /** Custom-scheme deep link: `coupro://collection?token=…` */
  share_link: string;
  /** Universal Link: `https://api.coupro.pro/collection/<token>/?open_ext=1` */
  share_link_web?: string;
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

/**
 * Create a private share request and get a deep link.
 *
 * `recipientPhone` is optional: the backend issues the share token
 * regardless. When the caller wants to surface the share through the
 * native iOS/Android share sheet, omit the phone — the returned
 * `share_link_web` is the URL to feed `Share.share({ url })`.
 */
export async function shareCoupon(id: string, recipientPhone?: string): Promise<ShareResponse> {
  try {
    const body: Record<string, unknown> = {};
    if (recipientPhone) body.to_phone_number = recipientPhone;
    const response = await apiClient.post<ShareResponse>(`/api/coupons/${id}/share/`, body);
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

/** Withdraw a coupon from the public CouMap pool back to the user's wallet. */
export async function withdrawShare(shareId: number): Promise<void> {
  try {
    await apiClient.post(`/api/coupon/share-public/${shareId}/withdraw/`);
  } catch (error) {
    throw normalizeError(error);
  }
}

export interface PublicShare {
  share_id: number;
  coupon_id: number;
  coupon_name: string;
  store_name: string | null;
  status: 'pending' | 'accepted' | 'cancelled';
  created_at: string;
}

export async function listMyPublicShares(): Promise<PublicShare[]> {
  try {
    const response = await apiClient.get<PublicShare[]>('/api/my-public-shares/');
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/** Daily-draw template (returned by GET /api/daily-draw-templates/). */
export interface DailyDrawTemplate {
  id: number;
  store_id: number;
  store_name: string;
  coupon_name: string;
  image_url: string | null;
  estimated_savings: number | null;
  expiry_date: string;
  remaining_quantity: number;
  draw_probability: number;
}

/** Normalized daily-draw result. */
export interface DailyDrawResult {
  success: boolean;
  /**
   * True when the server rejected the draw because the user already drew
   * today. Distinct from a `success: false` miss — the day is spent, not
   * a losing roll.
   */
  already_drawn?: boolean;
  /** Present only when success === true. */
  coupon?: {
    id: number;
    name: string;
    detail: string;
    important_notes: string | null;
    image_url: string | null;
    store_name: string;
    expiry_date: string;
    redeem_code: string | null;
    estimated_savings: number | null;
  };
  message: string;
}

/** Whether the user may still draw today (server-authoritative). */
export interface DailyDrawStatus {
  canDrawToday: boolean;
  /** Local (Asia/Taipei) date of the last draw, `YYYY-MM-DD`, or null. */
  lastDrawDate: string | null;
}

/** List the templates currently available for the daily draw. */
export async function listDailyDrawTemplates(): Promise<DailyDrawTemplate[]> {
  try {
    const response = await apiClient.get<{ active_templates?: DailyDrawTemplate[] }>(
      '/api/daily-draw-templates/',
    );
    return response.data.active_templates ?? [];
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Roll the daily draw. When called without a templateId, the server picks
 * a template weighted by draw_probability from the active pool.
 */
export async function dailyDraw(templateId?: number): Promise<DailyDrawResult> {
  try {
    const body = templateId !== undefined ? { template_id: templateId } : {};
    const response = await apiClient.post<DailyDrawResult>('/api/coupon/daily-draw/', body);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Whether the user can still draw today. The server (Asia/Taipei) is the
 * source of truth for the once-per-day limit; the UI only mirrors it.
 */
export async function getDailyDrawStatus(): Promise<DailyDrawStatus> {
  try {
    const response = await apiClient.get<{
      can_draw_today?: boolean;
      last_draw_date?: string | null;
    }>('/api/last-draw/');
    return {
      // Fail-open: if the flag is missing (older BE), let the user try —
      // the draw endpoint still enforces the limit authoritatively.
      canDrawToday: response.data.can_draw_today ?? true,
      lastDrawDate: response.data.last_draw_date ?? null,
    };
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
