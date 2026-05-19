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
import { apiClient, resetInterceptorState } from '../client';

const mockRefreshToken = mockRefreshTokenFn as jest.MockedFunction<typeof mockRefreshTokenFn>;

describe('apiClient interceptors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The interceptor keeps module-level `redirecting` and `refreshPromise`
    // state. Reset between tests so ordering doesn't matter.
    resetInterceptorState();
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

    // The Django backend's JWTAuthentication runs on every request and raises
    // InvalidToken (→ 401) on an expired access token, even for AllowAny views.
    // Attaching the expired access token to /api/token/refresh/ therefore
    // poisons the refresh flow: the BE returns 401 before the refresh view
    // sees the (valid) refresh_token in the body, and the FE wipes the user's
    // session despite the 30-day refresh token still being valid.
    //
    // The fix is to send AUTH_FREE_PATHS anonymously regardless of stored
    // token state.
    it.each([
      '/api/login/',
      '/api/token/refresh/',
      '/api/register/send-otp/',
      '/api/register/verify-otp/',
      '/api/phone-otp/send/',
      '/api/phone-otp/verify/',
      '/api/forgot-password/',
      '/api/reset-password/',
    ])('does not attach Authorization to auth-free path %s even when token stored', async (url) => {
      mockGetAccessToken.mockResolvedValue('expired-access-token');

      const interceptors = (apiClient.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.fulfilled;
      if (!handler) throw new Error('No request interceptor found');

      const config = { url, headers: {} as Record<string, string> };
      const result = await handler(config) as { headers: Record<string, string> };

      expect(result.headers['Authorization']).toBeUndefined();
    });

    it('strips query string before matching auth-free paths', async () => {
      // Defensive: a future call could include `?next=...` on the path; the
      // skip decision must still ignore query.
      mockGetAccessToken.mockResolvedValue('any-token');

      const interceptors = (apiClient.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.fulfilled;
      if (!handler) throw new Error('No request interceptor found');

      const config = { url: '/api/token/refresh/?source=bootstrap', headers: {} as Record<string, string> };
      const result = await handler(config) as { headers: Record<string, string> };

      expect(result.headers['Authorization']).toBeUndefined();
    });

    it('still attaches Authorization to protected endpoints', async () => {
      // Regression guard for the above change — the skip must be limited to
      // AUTH_FREE_PATHS; everything else still needs the bearer token.
      mockGetAccessToken.mockResolvedValue('valid-token');

      const interceptors = (apiClient.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.fulfilled;
      if (!handler) throw new Error('No request interceptor found');

      const config = { url: '/api/profile/', headers: {} as Record<string, string> };
      const result = await handler(config) as { headers: Record<string, string> };

      expect(result.headers['Authorization']).toBe('Bearer valid-token');
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

    it('does not refresh or navigate when /api/login/ returns 401', async () => {
      // Bug fix: a 401 from the login endpoint means "bad password", not
      // "stale token". The old interceptor ran the refresh-and-retry path
      // here, which remounted the login screen via router.replace and wiped
      // the catch handler's setError/setLoading, leaving the UI stuck on
      // "登入中…". Now the rejection propagates directly to the caller.
      const { router: mockRouter } = jest.requireMock('expo-router');

      const interceptors = (apiClient.interceptors.response as unknown as {
        handlers: Array<{ rejected: (error: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.rejected;
      if (!handler) throw new Error('No response interceptor found');

      const error = {
        response: { status: 401, data: { detail: '帳號或密碼錯誤' } },
        config: { _retry: false, headers: {}, url: '/api/login/' },
        isAxiosError: true,
        message: 'Request failed with status code 401',
      } as unknown as AxiosError;

      await expect(handler(error)).rejects.toMatchObject({
        status: 401,
        message: '帳號或密碼錯誤',
      });

      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(mockGetRefreshToken).not.toHaveBeenCalled();
      expect(mockClearTokens).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('does not recurse when /api/token/refresh/ itself returns 401', async () => {
      // Previously, a 401 from the refresh request would re-enter the
      // interceptor and await the in-flight refreshPromise (which is the
      // very promise that just rejected), risking a hang. Now the refresh
      // endpoint short-circuits to a direct rejection.
      const { router: mockRouter } = jest.requireMock('expo-router');

      const interceptors = (apiClient.interceptors.response as unknown as {
        handlers: Array<{ rejected: (error: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.rejected;
      if (!handler) throw new Error('No response interceptor found');

      const error = {
        response: { status: 401, data: { detail: 'Invalid refresh token' } },
        config: { _retry: false, headers: {}, url: '/api/token/refresh/' },
        isAxiosError: true,
      } as unknown as AxiosError;

      await expect(handler(error)).rejects.toMatchObject({ status: 401 });
      expect(mockGetRefreshToken).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('still redirects on a later session expiry after resetInterceptorState() runs', async () => {
      // Regression: `redirecting` was a module-level flag that latched true
      // after the first bounce-to-login. Once the user logged back in, a
      // SECOND session expiry in the same app lifecycle silently skipped
      // the redirect. AuthContext now calls resetInterceptorState() after
      // a successful login; this test proves the reset re-arms navigation.
      const { router: mockRouter } = jest.requireMock('expo-router');
      mockClearTokens.mockResolvedValue(undefined);

      const interceptors = (apiClient.interceptors.response as unknown as {
        handlers: Array<{ rejected: (error: unknown) => unknown }>;
      }).handlers;

      const handler = interceptors[interceptors.length - 1]?.rejected;
      if (!handler) throw new Error('No response interceptor found');

      // First bounce — no refresh token available.
      mockGetRefreshToken.mockResolvedValueOnce(null);
      const firstError = {
        response: { status: 401 },
        config: { _retry: false, headers: {}, url: '/api/protected' },
      } as unknown as AxiosError;
      await expect(handler(firstError)).rejects.toBeDefined();
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);

      // Simulate AuthContext clearing the latch after the user logs back in.
      resetInterceptorState();

      // Second bounce — must navigate again.
      mockGetRefreshToken.mockResolvedValueOnce(null);
      const secondError = {
        response: { status: 401 },
        config: { _retry: false, headers: {}, url: '/api/protected' },
      } as unknown as AxiosError;
      await expect(handler(secondError)).rejects.toBeDefined();
      expect(mockRouter.replace).toHaveBeenCalledTimes(2);
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
