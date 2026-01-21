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
 * Store information in blocked merchant response
 */
export interface BlockedStore {
  id: number;
  name: string;
  address: string | null;
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
export async function blockMerchant(
  storeId: number
): Promise<BlockMerchantResponse> {
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
export async function unblockMerchant(
  storeId: number
): Promise<UnblockMerchantResponse> {
  return authAPI.delete<UnblockMerchantResponse>(
    `/user/blocked-merchants/${storeId}/`
  );
}

/**
 * Get list of blocked merchants for the current user
 *
 * @returns Promise with list of blocked merchants
 */
export async function getBlockedMerchants(): Promise<BlockedMerchantsListResponse> {
  return authAPI.get<BlockedMerchantsListResponse>('/user/blocked-merchants/');
}

/**
 * Check if a store is blocked by the current user
 *
 * @param storeId - ID of the store to check
 * @returns Promise with block status
 */
export async function checkBlockStatus(
  storeId: number
): Promise<BlockStatusResponse> {
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
  return response.results.map((blocked) => blocked.store.id);
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
