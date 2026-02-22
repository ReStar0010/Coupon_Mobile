/**
 * Block List API Service
 * UGC Compliance (Apple Guideline 1.2) - User Story 2
 *
 * Provides functions for:
 * - Blocking merchants
 * - Unblocking merchants
 * - Listing blocked merchants
 * - Checking block status
 */

import { authAPI } from '../utils/authAPI';

// =============================================================================
// TypeScript Interfaces
// =============================================================================

/**
 * Store information in blocked merchant response (nested from API).
 * API may also return flat store_id/store_name; normalized to this shape.
 */
export interface BlockedStore {
  id: number;
  name: string;
  address: string | null;
  image_url?: string | null;
}

/**
 * Blocked merchant entry
 */
export interface BlockedMerchant {
  id: number;
  store: BlockedStore;
  created_at: string;
}

/**
 * Request body for blocking a merchant
 */
export interface BlockMerchantRequest {
  store_id: number;
}

/**
 * Response from block merchant API
 */
export interface BlockMerchantResponse {
  message: string;
  blocked_merchant: BlockedMerchant;
}

/**
 * Response from unblock merchant API
 */
export interface UnblockMerchantResponse {
  message: string;
}

/**
 * Response from blocked merchants list API
 */
export interface BlockedMerchantsListResponse {
  results: BlockedMerchant[];
  total: number;
}

/**
 * Response from block status check
 */
export interface BlockStatusResponse {
  is_blocked: boolean;
  store_id: number;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Block a merchant store
 *
 * @param storeId - ID of the store to block
 * @returns Promise with the created block entry
 * @throws Error if store not found, already blocked, or trying to block own store
 */
export async function blockMerchant(storeId: number): Promise<BlockMerchantResponse> {
  return authAPI.post<BlockMerchantResponse>('/user/blocked-merchants/add/', {
    store_id: storeId,
  });
}

/**
 * Unblock a merchant store
 *
 * @param storeId - ID of the store to unblock
 * @returns Promise with success message
 * @throws Error if block record not found
 */
export async function unblockMerchant(storeId: number): Promise<UnblockMerchantResponse> {
  return authAPI.delete<UnblockMerchantResponse>(`/user/blocked-merchants/${storeId}/`);
}

/**
 * Normalize a single blocked-merchant item from API (handles nested `store` or flat store_id/store_name).
 */
function normalizeBlockedMerchant(raw: Record<string, unknown>): BlockedMerchant | null {
  const id = typeof raw.id === 'number' ? raw.id : null;
  const created_at = typeof raw.created_at === 'string' ? raw.created_at : '';
  if (id == null || !created_at) return null;

  let store: BlockedStore;
  const nested = raw.store as Record<string, unknown> | undefined;
  if (nested && typeof nested.id === 'number' && typeof nested.name === 'string') {
    store = {
      id: nested.id as number,
      name: nested.name as string,
      address: (nested.address as string) ?? null,
      image_url: (nested.image_url as string) ?? null,
    };
  } else {
    const storeId = typeof (raw as any).store_id === 'number' ? (raw as any).store_id : null;
    const storeName = typeof (raw as any).store_name === 'string' ? (raw as any).store_name : '';
    if (storeId == null) return null;
    store = { id: storeId, name: storeName, address: null };
  }

  return { id, store, created_at };
}

/**
 * Get list of blocked merchants for the current user
 *
 * @returns Promise with list of blocked merchants (store always nested)
 */
export async function getBlockedMerchants(): Promise<BlockedMerchantsListResponse> {
  const res = await authAPI.get<{ results?: unknown[]; total?: number }>(
    '/user/blocked-merchants/'
  );
  const rawResults = res?.results ?? [];
  const results = rawResults
    .map((item) => normalizeBlockedMerchant(item as Record<string, unknown>))
    .filter((b): b is BlockedMerchant => b != null);
  return {
    results,
    total: typeof res?.total === 'number' ? res.total : results.length,
  };
}

/**
 * Check if a store is blocked by the current user
 *
 * @param storeId - ID of the store to check
 * @returns Promise with block status
 */
export async function checkBlockStatus(storeId: number): Promise<BlockStatusResponse> {
  return authAPI.get<BlockStatusResponse>(`/store/${storeId}/block-status/`);
}

/**
 * Get list of blocked store IDs (for filtering)
 * Utility function that extracts just the IDs
 *
 * @returns Promise with array of blocked store IDs
 */
export async function getBlockedStoreIds(): Promise<number[]> {
  const response = await getBlockedMerchants();
  return (response.results ?? [])
    .map((blocked) => blocked?.store?.id)
    .filter((id): id is number => typeof id === 'number');
}

/**
 * Block List API object (for consistency with other APIs)
 */
export const blockListAPI = {
  blockMerchant,
  unblockMerchant,
  getBlockedMerchants,
  checkBlockStatus,
  getBlockedStoreIds,
};

export default blockListAPI;
