import axios, { AxiosError } from 'axios';

// We need to mock modules before importing client
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

// Mock tokenStore to control token values in tests
const mockGetAccessToken = jest.fn<Promise<string | null>, []>();
const mockGetRefreshToken = jest.fn<Promise<string | null>, []>();
const mockSetTokens = jest.fn<Promise<void>, [string, string]>();
const mockClearTokens = jest.fn<Promise<void>, []>();

jest.mock('../../../services/auth/tokenStore', () => ({
  getAccessToken: () => mockGetAccessToken(),
  getRefreshToken: () => mockGetRefreshToken(),
  setTokens: (a: string, r: string) => mockSetTokens(a, r),
  clearTokens: () => mockClearTokens(),
}));

jest.mock('../../../services/api/auth', () => ({
  refreshToken: jest.fn(),
}));

import { refreshToken as mockRefreshTokenFn } from '../../../services/api/auth';
import { apiClient } from '../client';

const mockRefreshToken = mockRefreshTokenFn as jest.MockedFunction<typeof mockRefreshTokenFn>;

describe('apiClient interceptors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('request interceptor', () => {
    it('attaches Authorization header from stored token', async () => {
      mockGetAccessToken.mockResolvedValue('my-access-token');

      // Access the request interceptor directly
      const interceptors = (apiClient.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.fulfilled;
      if (!handler) throw new Error('No request interceptor found');

      const config = { headers: {} as Record<string, string> };
      const result = await handler(config) as { headers: Record<string, string> };

      expect(result.headers['Authorization']).toBe('Bearer my-access-token');
    });

    it('does not attach header when no token stored', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      const interceptors = (apiClient.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.fulfilled;
      if (!handler) throw new Error('No request interceptor found');

      const config = { headers: {} as Record<string, string> };
      const result = await handler(config) as { headers: Record<string, string> };

      expect(result.headers['Authorization']).toBeUndefined();
    });
  });

  describe('response interceptor - token refresh', () => {
    it('refreshes token on 401 and retries original request', async () => {
      mockGetRefreshToken.mockResolvedValue('old-refresh-token');
      mockRefreshToken.mockResolvedValue({
        access: 'new-access-token',
        refresh: 'new-refresh-token',
      });
      mockSetTokens.mockResolvedValue(undefined);
      mockGetAccessToken.mockResolvedValue('new-access-token');

      const retryMock = jest.fn().mockResolvedValue({ data: 'retried-response' });
      (apiClient as unknown as { request: jest.Mock }).request = retryMock;

      const interceptors = (apiClient.interceptors.response as unknown as {
        handlers: Array<{ rejected: (error: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.rejected;
      if (!handler) throw new Error('No response interceptor found');

      const error = {
        response: { status: 401 },
        config: { _retry: false, headers: {} as Record<string, string>, url: '/api/test' },
      } as unknown as AxiosError;

      await handler(error);

      expect(mockRefreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(mockSetTokens).toHaveBeenCalledWith('new-access-token', 'new-refresh-token');
    });

    it('clears tokens on second 401 (retry already attempted)', async () => {
      mockClearTokens.mockResolvedValue(undefined);

      const interceptors = (apiClient.interceptors.response as unknown as {
        handlers: Array<{ rejected: (error: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.rejected;
      if (!handler) throw new Error('No response interceptor found');

      const error = {
        response: { status: 401 },
        config: { _retry: true, headers: {}, url: '/api/test' },
      } as unknown as AxiosError;

      await expect(handler(error)).rejects.toBeDefined();
      expect(mockClearTokens).toHaveBeenCalled();
    });

    it('only makes one refresh request when multiple concurrent 401s fire', async () => {
      mockGetRefreshToken.mockResolvedValue('refresh-token');
      // Simulate a slow refresh
      let resolveRefresh!: (val: { access: string; refresh: string }) => void;
      const slowRefresh = new Promise<{ access: string; refresh: string }>((res) => {
        resolveRefresh = res;
      });
      mockRefreshToken.mockReturnValue(slowRefresh);
      mockSetTokens.mockResolvedValue(undefined);
      mockGetAccessToken.mockResolvedValue('new-access-token');

      const retryMock = jest.fn().mockResolvedValue({ data: 'ok' });
      (apiClient as unknown as { request: jest.Mock }).request = retryMock;

      const interceptors = (apiClient.interceptors.response as unknown as {
        handlers: Array<{ rejected: (error: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.rejected;
      if (!handler) throw new Error('No response interceptor found');

      const makeError = () => ({
        response: { status: 401 },
        config: { _retry: false, headers: {} as Record<string, string>, url: '/api/test' },
      });

      // Fire two concurrent 401s
      const p1 = handler(makeError());
      const p2 = handler(makeError());

      resolveRefresh({ access: 'new-access', refresh: 'new-refresh' });

      await Promise.allSettled([p1, p2]);

      // Should only have refreshed once
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });
  });
});
