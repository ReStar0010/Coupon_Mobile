'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISSED_STORES_KEY = 'dismissed_deleted_merchant_stores';

type DismissedStoresContextType = {
  dismissedStoreIds: Set<number>;
  dismissStore: (storeId: number) => Promise<void>;
  isStoreDismissed: (storeId: number) => boolean;
  loading: boolean;
};

const DismissedStoresContext = createContext<DismissedStoresContextType>({
  dismissedStoreIds: new Set(),
  dismissStore: async () => {},
  isStoreDismissed: () => false,
  loading: true,
});

export const useDismissedStores = () => useContext(DismissedStoresContext);

interface DismissedStoresProviderProps {
  children: React.ReactNode;
}

const DismissedStoresProvider = ({ children }: DismissedStoresProviderProps) => {
  const [dismissedStoreIds, setDismissedStoreIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load dismissed stores from AsyncStorage on mount
  useEffect(() => {
    const loadDismissedStores = async () => {
      try {
        const stored = await AsyncStorage.getItem(DISMISSED_STORES_KEY);
        if (stored) {
          const ids = JSON.parse(stored) as number[];
          setDismissedStoreIds(new Set(ids));
        }
      } catch (error) {
        console.error('Error loading dismissed stores:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDismissedStores();
  }, []);

  // Dismiss a store (add to dismissed list and persist)
  const dismissStore = useCallback(async (storeId: number) => {
    setDismissedStoreIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(storeId);

      // Persist to AsyncStorage
      AsyncStorage.setItem(DISMISSED_STORES_KEY, JSON.stringify([...newSet])).catch((error) => {
        console.error('Error saving dismissed stores:', error);
      });

      return newSet;
    });
  }, []);

  // Check if a store is dismissed
  const isStoreDismissed = useCallback(
    (storeId: number) => {
      return dismissedStoreIds.has(storeId);
    },
    [dismissedStoreIds],
  );

  const contextValue: DismissedStoresContextType = {
    dismissedStoreIds,
    dismissStore,
    isStoreDismissed,
    loading,
  };

  return (
    <DismissedStoresContext.Provider value={contextValue}>
      {children}
    </DismissedStoresContext.Provider>
  );
};

export default DismissedStoresProvider;
