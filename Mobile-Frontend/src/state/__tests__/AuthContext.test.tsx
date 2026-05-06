import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockLogin = jest.fn();
const mockLogoutApi = jest.fn();
const mockVerifyOtp = jest.fn();

jest.mock('../../services/api/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  logout: () => mockLogoutApi(),
  verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
  requestOtp: jest.fn(),
  register: jest.fn(),
  refreshToken: jest.fn(),
}));

const mockGetAccessToken = jest.fn<Promise<string | null>, []>();
const mockClearTokens = jest.fn<Promise<void>, []>();
const mockSetTokensFn = jest.fn<Promise<void>, [string, string]>();

jest.mock('../../services/auth/tokenStore', () => ({
  getAccessToken: () => mockGetAccessToken(),
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setTokens: (a: string, r: string) => mockSetTokensFn(a, r),
  clearTokens: () => mockClearTokens(),
}));

jest.mock('../../services/api/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({
    id: '1',
    email: 'user@example.com',
    phoneVerified: false,
  }),
}));

import { AuthProvider, useAuth } from '../AuthContext';

function TestComponent() {
  const { isAuthenticated, user, isLoading } = useAuth();
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="authenticated">{String(isAuthenticated)}</Text>
      <Text testID="email">{user?.email ?? 'none'}</Text>
    </>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearTokens.mockResolvedValue(undefined);
    mockSetTokensFn.mockResolvedValue(undefined);
    mockLogoutApi.mockResolvedValue(undefined);
  });

  describe('initial state', () => {
    it('is not authenticated when no stored token', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      const { getByTestId } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('authenticated').props.children).toBe('false');
      expect(getByTestId('email').props.children).toBe('none');
    });
  });

  describe('login', () => {
    it('sets user after successful login', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      mockLogin.mockResolvedValue({
        access: 'access-token',
        refresh: 'refresh-token',
        user: { id: '1', email: 'user@example.com', phoneVerified: false },
      });

      let authHook!: ReturnType<typeof useAuth>;

      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(authHook.isLoading).toBe(false);
      });

      await act(async () => {
        await authHook.login('user@example.com', undefined, 'password');
      });

      expect(authHook.isAuthenticated).toBe(true);
      expect(authHook.user?.email).toBe('user@example.com');
    });
  });

  describe('logout', () => {
    it('clears user and tokens on logout', async () => {
      // Start authenticated
      mockGetAccessToken.mockResolvedValue('existing-token');
      mockLogin.mockResolvedValue({
        access: 'access-token',
        refresh: 'refresh-token',
        user: { id: '1', email: 'user@example.com', phoneVerified: false },
      });

      let authHook!: ReturnType<typeof useAuth>;

      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(authHook.isLoading).toBe(false);
      });

      await act(async () => {
        await authHook.login('user@example.com', undefined, 'password');
      });

      expect(authHook.isAuthenticated).toBe(true);

      await act(async () => {
        await authHook.logout();
      });

      expect(authHook.isAuthenticated).toBe(false);
      expect(authHook.user).toBeNull();
      expect(mockClearTokens).toHaveBeenCalled();
    });
  });
});
