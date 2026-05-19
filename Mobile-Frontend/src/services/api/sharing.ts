import { apiClient } from './client';
import { normalizeError } from './errors';

/**
 * Backend response when a share request is accepted.
 *
 * Mirrors the payload of POST /api/coupon/share/<token>/accept/. The
 * backend already returns more detail than this — we only project the
 * minimum the deep-link landing screen needs.
 */
export interface AcceptShareResponse {
  message: string;
  coupon_id: number;
  coupon_name: string;
  /** Acquisition method set by BE on the transferred coupon. */
  acquisition_method: 'public_pool' | 'transfer' | string;
}

/**
 * Accept a coupon share by its token. Issued by both the deep-link
 * landing route (Universal Link / custom scheme `coupro://collection?token=…`)
 * and any in-app "claim from list" flow that needs the same endpoint.
 *
 * Surface errors as-is — the FE's response interceptor handles 401s,
 * and the BE returns clear 4xx codes for the common "already claimed",
 * "self claim", "expired" cases.
 */
export async function acceptShare(token: string): Promise<AcceptShareResponse> {
  try {
    const response = await apiClient.post<AcceptShareResponse>(
      `/api/coupon/share/${encodeURIComponent(token)}/accept/`,
      {},
    );
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}
