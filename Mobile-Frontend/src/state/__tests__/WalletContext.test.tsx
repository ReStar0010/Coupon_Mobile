import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockGetWallet = jest.fn();
const mockListMyCoupons = jest.fn();

jest.mock('../../services/api/profile', () => ({
  getWallet: () => mockGetWallet(),
}));

jest.mock('../../services/api/coupons', () => ({
  listMyCoupons: () => mockListMyCoupons(),
}));

// Mock AuthContext to provide an authenticated state
const mockUseAuth = jest.fn();

jest.mock('../AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { WalletProvider, useWallet } from '../WalletContext';

function TestComponent() {
  const { gems, couPoints, coupons, isLoading } = useWallet();
  return (
    <>
      <Text testID="gems">{String(gems)}</Text>
      <Text testID="couPoints">{String(couPoints)}</Text>
      <Text testID="couponCount">{String(coupons.length)}</Text>
      <Text testID="loading">{String(isLoading)}</Text>
    </>
  );
}

describe('WalletContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshWallet', () => {
    it('updates gems and couPoints after refresh', async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true });
      mockGetWallet.mockResolvedValue({ gems: 150, couPoints: 300 });
      mockListMyCoupons.mockResolvedValue([]);

      let walletHook!: ReturnType<typeof useWallet>;

      function Capture() {
        walletHook = useWallet();
        return null;
      }

      render(
        <WalletProvider>
          <Capture />
        </WalletProvider>,
      );

      await waitFor(() => {
        expect(walletHook.isLoading).toBe(false);
      });

      expect(walletHook.gems).toBe(150);
      expect(walletHook.couPoints).toBe(300);

      // Simulate a wallet update
      mockGetWallet.mockResolvedValue({ gems: 200, couPoints: 400 });
      mockListMyCoupons.mockResolvedValue([]);

      await act(async () => {
        await walletHook.refreshWallet();
      });

      expect(walletHook.gems).toBe(200);
      expect(walletHook.couPoints).toBe(400);
    });
  });

  describe('spendGems', () => {
    it('decrements gems locally (optimistic update)', async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true });
      mockGetWallet.mockResolvedValue({ gems: 100, couPoints: 0 });
      mockListMyCoupons.mockResolvedValue([]);

      let walletHook!: ReturnType<typeof useWallet>;

      function Capture() {
        walletHook = useWallet();
        return null;
      }

      render(
        <WalletProvider>
          <Capture />
        </WalletProvider>,
      );

      await waitFor(() => {
        expect(walletHook.isLoading).toBe(false);
        expect(walletHook.gems).toBe(100);
      });

      act(() => {
        walletHook.spendGems(30);
      });

      expect(walletHook.gems).toBe(70);
    });
  });

  describe('initial state when not authenticated', () => {
    it('does not fetch wallet data when not authenticated', async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false });

      render(
        <WalletProvider>
          <TestComponent />
        </WalletProvider>,
      );

      await waitFor(() => {
        // Brief delay to allow any effects to run
      });

      expect(mockGetWallet).not.toHaveBeenCalled();
      expect(mockListMyCoupons).not.toHaveBeenCalled();
    });
  });
});
