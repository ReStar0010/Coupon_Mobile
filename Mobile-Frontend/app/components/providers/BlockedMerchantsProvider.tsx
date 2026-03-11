/**
 * Blocked Merchants Provider
 * UGC Compliance (Apple Guideline 1.2) - User Story 2
 *
 * Provides context for managing blocked merchants:
 * - Fetches blocked store IDs on mount
 * - Provides methods to block/unblock merchants
 * - Provides helper to check if a store is blocked
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { isAxiosError } from 'axios';
import { blockListAPI, BlockedMerchant } from '@/app/services/blockListAPI';
import { isUserLoggedIn } from '@/app/utils/authAPI';
import { useApiError } from '@/app/hooks/useApiError';

// =============================================================================
// Context Types
// =============================================================================

export type BlockStoreResult = { success: true } | { success: false; message: string };
export type UnblockStoreResult = { success: true } | { success: false; message: string };

interface BlockedMerchantsContextType {
  /** List of blocked merchants with full details */
  blockedMerchants: BlockedMerchant[];
  /** Set of blocked store IDs for quick lookup */
  blockedStoreIds: Set<number>;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Check if a store is blocked */
  isStoreBlocked: (storeId: number) => boolean;
  /** Block a merchant */
  blockStore: (storeId: number) => Promise<BlockStoreResult>;
  /** Unblock a merchant */
  unblockStore: (storeId: number) => Promise<UnblockStoreResult>;
  /** Refresh the blocked merchants list */
  refresh: () => Promise<void>;
}

const BlockedMerchantsContext = createContext<BlockedMerchantsContextType | undefined>(undefined);

// =============================================================================
// Provider Component
// =============================================================================

interface BlockedMerchantsProviderProps {
  children: ReactNode;
}

export function BlockedMerchantsProvider({ children }: BlockedMerchantsProviderProps) {
  const { getErrorMessage } = useApiError();
  const [blockedMerchants, setBlockedMerchants] = useState<BlockedMerchant[]>([]);
  const [blockedStoreIds, setBlockedStoreIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasValidStore = (b: BlockedMerchant | undefined | null): b is BlockedMerchant => {
    return (
      !!b &&
      !!(b as any).store &&
      typeof (b as any).store.id === 'number' &&
      typeof (b as any).store.name === 'string'
    );
  };

  /**
   * Fetch blocked merchants from backend
   */
  const fetchBlockedMerchants = useCallback(async () => {
    // Only fetch if user is logged in
    if (!isUserLoggedIn()) {
      setBlockedMerchants([]);
      setBlockedStoreIds(new Set());
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await blockListAPI.getBlockedMerchants();
      const validResults = (response.results ?? []).filter(hasValidStore);
      setBlockedMerchants(validResults);
      setBlockedStoreIds(new Set(validResults.map((b) => b.store.id)));
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setBlockedMerchants([]);
        setBlockedStoreIds(new Set());
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  }, [getErrorMessage]);

  /**
   * Check if a store is blocked
   */
  const isStoreBlocked = useCallback(
    (storeId: number): boolean => {
      return blockedStoreIds.has(storeId);
    },
    [blockedStoreIds],
  );

  /**
   * Block a merchant store
   */
  const blockStore = useCallback(
    async (storeId: number): Promise<BlockStoreResult> => {
      try {
        const response = await blockListAPI.blockMerchant(storeId);
        const created = response?.blocked_merchant;
        if (hasValidStore(created)) {
          setBlockedMerchants((prev) => [...prev, created]);
          setBlockedStoreIds((prev) => new Set([...prev, storeId]));
        } else {
          await fetchBlockedMerchants();
        }
        return { success: true };
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        return { success: false, message };
      }
    },
    [fetchBlockedMerchants, getErrorMessage],
  );

  /**
   * Unblock a merchant store
   */
  const unblockStore = useCallback(
    async (storeId: number): Promise<UnblockStoreResult> => {
      try {
        await blockListAPI.unblockMerchant(storeId);
        setBlockedMerchants((prev) => prev.filter((b) => b?.store?.id !== storeId));
        setBlockedStoreIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(storeId);
          return newSet;
        });
        return { success: true };
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        return { success: false, message };
      }
    },
    [getErrorMessage],
  );

  // Fetch blocked merchants on mount
  useEffect(() => {
    fetchBlockedMerchants();
  }, [fetchBlockedMerchants]);

  const value: BlockedMerchantsContextType = {
    blockedMerchants,
    blockedStoreIds,
    isLoading,
    error,
    isStoreBlocked,
    blockStore,
    unblockStore,
    refresh: fetchBlockedMerchants,
  };

  return (
    <BlockedMerchantsContext.Provider value={value}>{children}</BlockedMerchantsContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access blocked merchants context
 * @throws Error if used outside of BlockedMerchantsProvider
 */
export function useBlockedMerchants(): BlockedMerchantsContextType {
  const context = useContext(BlockedMerchantsContext);
  if (context === undefined) {
    throw new Error('useBlockedMerchants must be used within a BlockedMerchantsProvider');
  }
  return context;
}

export default BlockedMerchantsProvider;
