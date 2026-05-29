import { apiClient } from './client';
import { normalizeError } from './errors';

export type HistoryType = 'all' | 'coupon' | 'coupoint';

export interface HistoryEntry {
  /** Server uses an int PK; we expose it as a string for stable React keys. */
  id: string;
  /** Raw WalletTransaction.Kind value (eg 'coupon_redeem', 'spinner_solo'). */
  kind: string;
  /** UI bucket — drives the type pill colour on the list + detail screens. */
  type: 'coupon' | 'coupoint';
  /** Merchant name when the row is tied to a store, otherwise null. */
  store: string | null;
  /** Human-readable single-line description, eg "$25 折抵 — 阿明早餐店". */
  detail: string;
  /** abs(delta_*) of the relevant currency — never negative. */
  amount: number;
  /** Server-formatted local timestamp, "YYYY-MM-DD HH:MM". */
  usedAt: string;
  balanceAfterGems: number;
  balanceAfterCouPoints: number;
}

export interface HistoryPage {
  items: HistoryEntry[];
  /** id of the last seen row; pass to the next call to fetch the next page. */
  nextCursor: number | null;
}

export interface CouponReference {
  id: number;
  name: string;
}

export type HistoryEntryDetail = HistoryEntry & { coupon?: CouponReference };

interface RawHistoryEntry {
  id: number;
  kind: string;
  type: 'coupon' | 'coupoint';
  store: string | null;
  detail: string;
  amount: number;
  usedAt: string;
  balanceAfterGems: number;
  balanceAfterCouPoints: number;
}

interface RawHistoryPage {
  items: RawHistoryEntry[];
  nextCursor: number | null;
}

interface RawHistoryDetail extends RawHistoryEntry {
  coupon?: CouponReference;
}

function toEntry(raw: RawHistoryEntry): HistoryEntry {
  return {
    id: String(raw.id),
    kind: raw.kind,
    type: raw.type,
    store: raw.store,
    detail: raw.detail,
    amount: raw.amount,
    usedAt: raw.usedAt,
    balanceAfterGems: raw.balanceAfterGems,
    balanceAfterCouPoints: raw.balanceAfterCouPoints,
  };
}

/**
 * Fetch a paginated page of wallet history rows for the authenticated user.
 * Cursor-based: pass `nextCursor` from the previous response as `cursor` to
 * load the next page. A null nextCursor means "no more rows".
 */
export async function listTransactions(
  type: HistoryType = 'all',
  limit?: number,
  cursor?: number | null,
): Promise<HistoryPage> {
  try {
    const params: Record<string, string> = { type };
    if (typeof limit === 'number') {
      params.limit = String(limit);
    }
    if (typeof cursor === 'number') {
      params.cursor = String(cursor);
    }
    const response = await apiClient.get<RawHistoryPage>('/api/wallet/transactions/', {
      params,
    });
    return {
      items: response.data.items.map(toEntry),
      nextCursor: response.data.nextCursor,
    };
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Fetch a single wallet history row by id. Throws an ApiRequestError with
 * status=404 when the row does not exist or belongs to another user.
 */
export async function getTransaction(id: string | number): Promise<HistoryEntryDetail> {
  try {
    const response = await apiClient.get<RawHistoryDetail>(
      `/api/wallet/transactions/${id}/`,
    );
    const { coupon, ...rest } = response.data;
    const entry: HistoryEntryDetail = toEntry(rest);
    if (coupon) {
      entry.coupon = coupon;
    }
    return entry;
  } catch (error) {
    throw normalizeError(error);
  }
}
