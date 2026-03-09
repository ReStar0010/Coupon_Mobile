/**
 * Unit tests for authAPI - isPublicEndpoint, refreshAccessToken, logout, storeLoginData
 */

const mockEmit = jest.fn();
const mockGetRefreshToken = jest.fn();
const mockGetAccessToken = jest.fn();
const mockStoreTokens = jest.fn();
const mockClearTokens = jest.fn();
const mockHasValidRefreshToken = jest.fn();
const mockInitStorage = jest.fn();

jest.mock('../authEvents', () => ({
  authEvents: { emit: (...args: unknown[]) => mockEmit(...args) },
  AUTH_EVENT_TYPES: {
    AUTH_FAILURE: 'AUTH_FAILURE',
    LOGOUT_REQUESTED: 'LOGOUT_REQUESTED',
    SESSION_REFRESHED: 'SESSION_REFRESHED',
  },
}));

jest.mock('../tokenUtils', () => ({
  getAccessToken: () => mockGetAccessToken(),
  getRefreshToken: () => mockGetRefreshToken(),
  storeTokens: (...args: unknown[]) => mockStoreTokens(...args),
  clearTokens: (...args: unknown[]) => mockClearTokens(...args),
  hasValidRefreshToken: () => mockHasValidRefreshToken(),
  initStorage: (...args: unknown[]) => mockInitStorage(...args),
}));

jest.mock('axios', () => {
  const mockAxiosFn = jest.fn();
  return {
    __esModule: true,
    default: Object.assign(mockAxiosFn, {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    }),
    isAxiosError: jest.fn((e: unknown) => (e as { isAxiosError?: boolean })?.isAxiosError === true),
  };
});

import axios from 'axios';
import authAPIModule from '../authAPI';
import { refreshAccessToken, logout, storeLoginData } from '../authAPI';

const isPublicEndpoint = authAPIModule.isPublicEndpoint as (endpoint: string) => boolean;

describe('authAPI (unit)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearTokens.mockResolvedValue(undefined);
    mockStoreTokens.mockResolvedValue(undefined);
    mockInitStorage.mockResolvedValue(undefined);
    global.fetch = originalFetch;
  });

  describe('isPublicEndpoint', () => {
    it('returns true for login and register endpoints', () => {
      expect(isPublicEndpoint('/login/')).toBe(true);
      expect(isPublicEndpoint('/register/')).toBe(true);
      expect(isPublicEndpoint('/register/send-otp/')).toBe(true);
      expect(isPublicEndpoint('/register/verify-otp/')).toBe(true);
    });

    it('returns true for forgot-password and phone reset', () => {
      expect(isPublicEndpoint('/forgot-password/')).toBe(true);
      expect(isPublicEndpoint('/forgot-password/phone/send-otp/')).toBe(true);
      expect(isPublicEndpoint('/forgot-password/phone/reset/')).toBe(true);
    });

    it('returns true for store-coupons and coupon share', () => {
      expect(isPublicEndpoint('/store-coupons/')).toBe(true);
      expect(isPublicEndpoint('coupon/share/<str:token>/')).toBe(true);
    });

    it('returns false for protected endpoints', () => {
      expect(isPublicEndpoint('/user-info/')).toBe(false);
      expect(isPublicEndpoint('/exclusive-coupons/')).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('when no refresh token, emits AUTH_FAILURE and returns false', async () => {
      mockGetRefreshToken.mockReturnValue(null);
      const fetchSpy = jest.spyOn(global, 'fetch');

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(mockEmit).toHaveBeenCalledWith({
        type: 'AUTH_FAILURE',
        reason: 'no_refresh_token',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('when fetch returns not ok, clears tokens, emits AUTH_FAILURE, returns false', async () => {
      mockGetRefreshToken.mockReturnValue('refresh-xyz');
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(mockClearTokens).toHaveBeenCalled();
      expect(mockEmit).toHaveBeenCalledWith({
        type: 'AUTH_FAILURE',
        reason: 'refresh_failed',
      });
    });

    it('when fetch returns ok and access_token, stores tokens and emits SESSION_REFRESHED', async () => {
      mockGetRefreshToken.mockReturnValue('refresh-xyz');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
          }),
      });

      const result = await refreshAccessToken();

      expect(result).toBe(true);
      expect(mockStoreTokens).toHaveBeenCalledWith('new-access', 'new-refresh');
      expect(mockEmit).toHaveBeenCalledWith({ type: 'SESSION_REFRESHED' });
    });

    it('accepts access/refresh alias in response', async () => {
      mockGetRefreshToken.mockReturnValue('old-refresh');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access: 'alt-access',
            refresh: 'alt-refresh',
          }),
      });

      const result = await refreshAccessToken();

      expect(result).toBe(true);
      expect(mockStoreTokens).toHaveBeenCalledWith('alt-access', 'alt-refresh');
    });

    it('when fetch throws, emits AUTH_FAILURE with reason refresh_error', async () => {
      mockGetRefreshToken.mockReturnValue('refresh-xyz');
      global.fetch = jest.fn().mockRejectedValue(new Error('network'));

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(mockEmit).toHaveBeenCalledWith({
        type: 'AUTH_FAILURE',
        reason: 'refresh_error',
      });
    });
  });

  describe('logout', () => {
    it('calls clearTokens and emits LOGOUT_REQUESTED even when fetchAPI throws', async () => {
      (axios as jest.Mock).mockRejectedValueOnce(new Error('network'));

      await logout();

      expect(mockClearTokens).toHaveBeenCalled();
      expect(mockEmit).toHaveBeenCalledWith({ type: 'LOGOUT_REQUESTED' });
    });
  });

  describe('storeLoginData', () => {
    it('stores tokens and emits SESSION_REFRESHED', async () => {
      await storeLoginData({
        access_token: 'a1',
        refresh_token: 'r1',
      });

      expect(mockStoreTokens).toHaveBeenCalledWith('a1', 'r1');
      expect(mockEmit).toHaveBeenCalledWith({ type: 'SESSION_REFRESHED' });
    });

    it('throws when tokens missing', async () => {
      await expect(storeLoginData({})).rejects.toThrow('Invalid login response: missing tokens');
      await expect(storeLoginData({ access_token: 'a' })).rejects.toThrow(
        'Invalid login response: missing tokens',
      );
    });
  });
});
