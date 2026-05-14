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
  /**
   * @deprecated Wallet mutations now happen on the server. After the
   * mutating API call (e.g. `drawSpinner`), call `refreshWallet()` to
   * pull the canonical balance. This no-op exists so existing screens
   * that still pass it through props continue to type-check; it will
   * be removed in a future cleanup.
   */
  spendGems: (n: number) => void;
  /**
   * @deprecated Wallet mutations now happen on the server. After the
   * mutating API call (e.g. `drawSpinner`), call `refreshWallet()` to
   * pull the canonical balance. This no-op exists so existing screens
   * that still pass it through props continue to type-check; it will
   * be removed in a future cleanup.
   */
  addPoints: (n: number) => void;
  /**
   * @deprecated Wallet mutations now happen on the server. After the
   * mutating API call (redeemCoupon, acceptShare, claimQr, etc.), call
   * `refreshWallet()` to pull the canonical balance. This no-op exists
   * so existing screens that still pass it through props continue to
   * type-check; it will be removed in a future cleanup.
   */
  setGemsLocal: (fn: (prev: number) => number) => void;
  /**
   * @deprecated Wallet mutations now happen on the server. After the
   * mutating API call (e.g. `useCouPoints`), call `refreshWallet()` to
   * pull the canonical balance. This no-op exists so existing screens
   * that still pass it through props continue to type-check; it will
   * be removed in a future cleanup.
   */
  setCouPointsLocal: (fn: (prev: number) => number) => void;
}

/**
 * Wallet context value. The context owns the **read** side of the
 * wallet (`gems`, `couPoints`, `coupons`, `isLoading`) plus
 * `refreshWallet`, which is the single supported way to refresh state.
 *
 * Wallet mutations are server-authoritative. They happen through
 * service-module API calls — `redeemCoupon`, `acceptShare`, `claimQr`,
 * `drawSpinner`, `useCouPoints`, etc. After such a call resolves,
 * callers should invoke `refreshWallet()` to pull the canonical
 * balance from the server. The legacy mutator actions on this context
 * (`spendGems`, `addPoints`, `setGemsLocal`, `setCouPointsLocal`) are
 * deprecated no-ops kept only for prop-pass-through compatibility.
 */
type WalletContextValue = WalletState & WalletActions;

const WalletContext = createContext<WalletContextValue | null>(null);

// Module-level guard so each deprecated mutator warns at most once per session.
const warnedDeprecations = new Set<string>();

function warnDeprecated(method: string): void {
  if (warnedDeprecations.has(method)) {
    return;
  }
  warnedDeprecations.add(method);
  // eslint-disable-next-line no-console
  console.warn(
    `[WalletContext] ${method}() is deprecated and is now a no-op. ` +
      'Wallet mutations are server-authoritative — after the mutating API call, ' +
      'call refreshWallet() to pull the canonical balance.',
  );
}

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

  /**
   * @deprecated See {@link WalletActions.spendGems}. No-op; warns once per session.
   */
  const spendGems = useCallback((_n: number): void => {
    warnDeprecated('spendGems');
  }, []);

  /**
   * @deprecated See {@link WalletActions.addPoints}. No-op; warns once per session.
   */
  const addPoints = useCallback((_n: number): void => {
    warnDeprecated('addPoints');
  }, []);

  /**
   * @deprecated See {@link WalletActions.setGemsLocal}. No-op; warns once per session.
   */
  const setGemsLocal = useCallback((_fn: (prev: number) => number): void => {
    warnDeprecated('setGemsLocal');
  }, []);

  /**
   * @deprecated See {@link WalletActions.setCouPointsLocal}. No-op; warns once per session.
   */
  const setCouPointsLocal = useCallback((_fn: (prev: number) => number): void => {
    warnDeprecated('setCouPointsLocal');
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
