import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { listMyCoupons } from '../services/api/coupons';
import type { Coupon } from '../services/api/coupons';
import { getWallet } from '../services/api/profile';
import { useAuth } from './AuthContext';

interface WalletState {
  gems: number;
  couPoints: number;
  coupons: Coupon[];
  isLoading: boolean;
}

interface WalletActions {
  refreshWallet: () => Promise<void>;
  spendGems: (n: number) => void;
  addPoints: (n: number) => void;
  setGemsLocal: (fn: (prev: number) => number) => void;
  setCouPointsLocal: (fn: (prev: number) => number) => void;
}

type WalletContextValue = WalletState & WalletActions;

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps): React.JSX.Element {
  const { isAuthenticated } = useAuth();
  const [gems, setGems] = useState(0);
  const [couPoints, setCouPoints] = useState(0);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshWallet = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [walletData, couponList] = await Promise.all([
        getWallet(),
        listMyCoupons(),
      ]);
      setGems(walletData.gems);
      setCouPoints(walletData.couPoints);
      setCoupons(couponList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch wallet data when the user becomes authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void refreshWallet();
  }, [isAuthenticated, refreshWallet]);

  const spendGems = useCallback((n: number): void => {
    setGems((prev) => Math.max(0, prev - n));
  }, []);

  const addPoints = useCallback((n: number): void => {
    setCouPoints((prev) => prev + n);
  }, []);

  const setGemsLocal = useCallback((fn: (prev: number) => number): void => {
    setGems(fn);
  }, []);

  const setCouPointsLocal = useCallback((fn: (prev: number) => number): void => {
    setCouPoints(fn);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      gems,
      couPoints,
      coupons,
      isLoading,
      refreshWallet,
      spendGems,
      addPoints,
      setGemsLocal,
      setCouPointsLocal,
    }),
    [gems, couPoints, coupons, isLoading, refreshWallet, spendGems, addPoints, setGemsLocal, setCouPointsLocal],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
