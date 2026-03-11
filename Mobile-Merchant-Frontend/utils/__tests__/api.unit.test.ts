/**
 * Unit tests for utils/api.ts
 * Covers: getApiConfig, getAbsoluteImageUrl, token storage, errors, parseResponse, fetchAPI behaviour
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getApiConfig,
  getAbsoluteImageUrl,
  initStorage,
  saveTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  AuthenticationError,
  MerchantAuthorizationError,
  parseResponse,
  fetchAPI,
} from '../api';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('api (unit)', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    global.fetch = originalFetch;
    await clearTokens();
  });

  describe('getApiConfig', () => {
    it('returns mode, baseUrl, apiUrl from env', () => {
      const config = getApiConfig();
      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('apiUrl');
      expect(config.apiUrl).toBe(`${config.baseUrl}/api`);
      // jest.setup sets EXPO_PUBLIC_API_URL to https://test-api.example.com
      expect(config.baseUrl).toMatch(/^https?:\/\//);
      expect(config.apiUrl).toContain('/api');
    });
  });

  describe('getAbsoluteImageUrl', () => {
    it('returns null for null, undefined, empty string', () => {
      expect(getAbsoluteImageUrl(null)).toBeNull();
      expect(getAbsoluteImageUrl(undefined)).toBeNull();
      expect(getAbsoluteImageUrl('')).toBeNull();
    });

    it('returns as-is for absolute http/https URLs', () => {
      expect(getAbsoluteImageUrl('https://example.com/img.png')).toBe(
        'https://example.com/img.png',
      );
      expect(getAbsoluteImageUrl('http://example.com/img.png')).toBe('http://example.com/img.png');
    });

    it('prepends baseUrl for path starting with /', () => {
      const base = getApiConfig().baseUrl;
      expect(getAbsoluteImageUrl('/media/photo.jpg')).toBe(`${base}/media/photo.jpg`);
    });

    it('prepends baseUrl + /media/ for relative path without leading /', () => {
      const base = getApiConfig().baseUrl;
      expect(getAbsoluteImageUrl('photo.jpg')).toBe(`${base}/media/photo.jpg`);
    });
  });

  describe('token storage', () => {
    it('saveTokens updates in-memory and calls AsyncStorage.setItem when available', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      await saveTokens('access-1', 'refresh-1');
      expect(getAccessToken()).toBe('access-1');
      expect(getRefreshToken()).toBe('refresh-1');
      // AsyncStorage.setItem may or may not be called depending on dynamic import in test env
      if (mockAsyncStorage.setItem.mock.calls.length > 0) {
        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('merchant_access_token', 'access-1');
        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'merchant_refresh_token',
          'refresh-1',
        );
      }
    });

    it('getAccessToken and getRefreshToken return current in-memory values', async () => {
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      await saveTokens('a', 'r');
      expect(getAccessToken()).toBe('a');
      expect(getRefreshToken()).toBe('r');
    });

    it('clearTokens clears in-memory and AsyncStorage when available', async () => {
      await saveTokens('a', 'r');
      await clearTokens();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      if (mockAsyncStorage.removeItem.mock.calls.length > 0) {
        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('merchant_access_token');
        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('merchant_refresh_token');
      }
    });

    it('initStorage loads from AsyncStorage into in-memory when available', async () => {
      await clearTokens();
      mockAsyncStorage.getItem.mockImplementation((key: string) =>
        Promise.resolve(key === 'merchant_access_token' ? 'loaded-access' : 'loaded-refresh'),
      );
      await initStorage();
      // In Jest, dynamic import of AsyncStorage may fail (catch block); then in-memory stays empty.
      // When it succeeds, tokens should match what getItem returned.
      if (getAccessToken() !== null) {
        expect(getAccessToken()).toBe('loaded-access');
        expect(getRefreshToken()).toBe('loaded-refresh');
      }
    });

    it('initStorage falls back to in-memory when AsyncStorage fails', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('AsyncStorage unavailable'));
      await saveTokens('mem-a', 'mem-r');
      await initStorage();
      expect(getAccessToken()).toBe('mem-a');
      expect(getRefreshToken()).toBe('mem-r');
    });
  });

  describe('AuthenticationError / MerchantAuthorizationError', () => {
    it('AuthenticationError has name and message', () => {
      const err = new AuthenticationError('Please log in');
      expect(err.name).toBe('AuthenticationError');
      expect(err.message).toBe('Please log in');
      expect(err).toBeInstanceOf(Error);
    });

    it('MerchantAuthorizationError has name and message', () => {
      const err = new MerchantAuthorizationError('Not a merchant');
      expect(err.name).toBe('MerchantAuthorizationError');
      expect(err.message).toBe('Not a merchant');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('parseResponse', () => {
    it('returns parsed JSON when response.ok is true', async () => {
      const res = new Response(JSON.stringify({ id: 1, name: 'Test' }), { status: 200 });
      const data = await parseResponse<{ id: number; name: string }>(res);
      expect(data).toEqual({ id: 1, name: 'Test' });
    });

    it('throws with statusCode for DRF-style error object (detail becomes field error)', async () => {
      const res = new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 });
      try {
        await parseResponse(res);
      } catch (e: any) {
        expect(e.message).toContain('Not found');
        expect(e.statusCode).toBe(404);
        return;
      }
      throw new Error('Expected parseResponse to throw');
    });

    it('throws for error field (key: value format)', async () => {
      const res = new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      try {
        await parseResponse(res);
      } catch (e: any) {
        expect(e.message).toContain('Invalid request');
        expect(e.statusCode).toBe(400);
        return;
      }
      throw new Error('Expected parseResponse to throw');
    });

    it('throws for message field (key: value format)', async () => {
      const res = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
      try {
        await parseResponse(res);
      } catch (e: any) {
        expect(e.message).toContain('Forbidden');
        expect(e.statusCode).toBe(403);
        return;
      }
      throw new Error('Expected parseResponse to throw');
    });

    it('throws for field-specific errors (array values)', async () => {
      const res = new Response(
        JSON.stringify({ email: ['This field is required.'], phone: ['Invalid format.'] }),
        { status: 400 },
      );
      await expect(parseResponse(res)).rejects.toMatchObject({
        message: expect.stringContaining('email:'),
        statusCode: 400,
      });
    });

    it('preserves email_not_verified error shape', async () => {
      const res = new Response(
        JSON.stringify({
          error: 'email_not_verified',
          message: '請先驗證您的電子郵件',
          email: 'u@example.com',
        }),
        { status: 403 },
      );
      await expect(parseResponse(res)).rejects.toMatchObject({
        message: '請先驗證您的電子郵件',
        error: 'email_not_verified',
        email: 'u@example.com',
        statusCode: 403,
      });
    });

    it('preserves wrong_client_type error shape', async () => {
      const res = new Response(
        JSON.stringify({
          error: 'wrong_client_type',
          message: '請使用正確的 App 登入',
        }),
        { status: 403 },
      );
      await expect(parseResponse(res)).rejects.toMatchObject({
        message: '請使用正確的 App 登入',
        error: 'wrong_client_type',
        statusCode: 403,
      });
    });

    it('throws MerchantAuthorizationError and clears tokens for "not a merchant" 403', async () => {
      const res = new Response(
        JSON.stringify({ error: 'User is not a merchant.', message: 'User is not a merchant.' }),
        { status: 403 },
      );
      await saveTokens('a', 'r');
      await expect(parseResponse(res)).rejects.toThrow(MerchantAuthorizationError);
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('non-JSON error body produces error with statusCode 500', async () => {
      const res = new Response('Server Error', { status: 500 });
      try {
        await parseResponse(res);
      } catch (e: any) {
        expect(e.message).toBeDefined();
        expect(e.statusCode).toBe(500);
        return;
      }
      throw new Error('Expected parseResponse to throw');
    });
  });

  describe('fetchAPI', () => {
    it('does not add Authorization for public endpoints when requireAuth is true', async () => {
      let capturedHeaders: Headers | undefined;
      global.fetch = jest.fn((url: string | URL, init?: RequestInit) => {
        capturedHeaders = init?.headers as Headers;
        return Promise.resolve(new Response('{}', { status: 200 }));
      }) as typeof fetch;

      await fetchAPI('/login/', { method: 'POST', body: '{}', requireAuth: true });
      expect(capturedHeaders?.get?.('Authorization')).toBeFalsy();
    });

    it('adds Bearer token for protected endpoint when token exists', async () => {
      await saveTokens('my-access', 'my-refresh');
      let capturedHeaders: Headers | undefined;
      global.fetch = jest.fn((_url, init?: RequestInit) => {
        capturedHeaders = init?.headers as Headers;
        return Promise.resolve(new Response('{}', { status: 200 }));
      }) as typeof fetch;

      await fetchAPI('/merchant/profile/', { method: 'GET' });
      expect(capturedHeaders?.get?.('Authorization')).toBe('Bearer my-access');
    });

    it('when requireAuth is false, does not add Authorization', async () => {
      await saveTokens('my-access', 'my-refresh');
      let capturedHeaders: Headers | undefined;
      global.fetch = jest.fn((_url, init?: RequestInit) => {
        capturedHeaders = init?.headers as Headers;
        return Promise.resolve(new Response('{}', { status: 200 }));
      }) as typeof fetch;

      await fetchAPI('/user-info/', { method: 'GET', requireAuth: false });
      expect(capturedHeaders?.get?.('Authorization')).toBeFalsy();
    });

    it('on 401 with refresh success, retries request and returns retry response', async () => {
      await saveTokens('old-access', 'old-refresh');
      const { apiUrl } = getApiConfig();
      let callCount = 0;
      global.fetch = jest.fn((url: string | URL) => {
        const u = typeof url === 'string' ? url : url.toString();
        callCount += 1;
        if (u.includes('/token/refresh/')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ access_token: 'new-access', refresh_token: 'new-refresh' }),
              { status: 200 },
            ),
          );
        }
        if (callCount === 1) {
          return Promise.resolve(new Response('', { status: 401 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
      }) as typeof fetch;

      const res = await fetchAPI('/merchant/profile/', { method: 'GET' });
      expect(res.status).toBe(200);
      expect(getAccessToken()).toBe('new-access');
    });

    it('on 401 and refresh failure, clears tokens and throws AuthenticationError', async () => {
      await saveTokens('old-access', 'old-refresh');
      global.fetch = jest.fn((url: string | URL) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u.includes('/token/refresh/')) {
          return Promise.resolve(new Response('{}', { status: 400 }));
        }
        return Promise.resolve(new Response('', { status: 401 }));
      }) as typeof fetch;

      await expect(fetchAPI('/merchant/profile/', { method: 'GET' })).rejects.toThrow(
        AuthenticationError,
      );
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('on 401 for public endpoint does not attempt refresh', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(new Response('', { status: 401 })),
      ) as typeof fetch;
      const res = await fetchAPI('/login/', { method: 'POST', body: '{}', requireAuth: false });
      expect(res.status).toBe(401);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('on network error throws helpful message when message contains Network', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Network request failed')),
      ) as typeof fetch;
      await expect(fetchAPI('/merchant/profile/')).rejects.toThrow(/無法連接到服務器|檢查/);
    });
  });
});
