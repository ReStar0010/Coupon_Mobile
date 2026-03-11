/**
 * Integration tests for utils/api.ts
 * Covers: fetchAPI 401 + token refresh queue, authAPI.login, merchantAPI methods, accountDeletionAPI
 */

import {
  fetchAPI,
  parseResponse,
  saveTokens,
  clearTokens,
  getAccessToken,
  authAPI,
  merchantAPI,
  accountDeletionAPI,
  AuthenticationError,
  getApiConfig,
} from '../api';

describe('api (integration)', () => {
  const { apiUrl } = getApiConfig();

  beforeEach(async () => {
    jest.clearAllMocks();
    await clearTokens();
  });

  describe('fetchAPI + 401 + token refresh queue', () => {
    it('on 401, refreshes token once then retries; concurrent requests share one refresh', async () => {
      await saveTokens('old-access', 'old-refresh');

      let profileCallCount = 0;
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((url: string | URL) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u.includes('/token/refresh/')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ access_token: 'new-access', refresh_token: 'new-refresh' }),
              { status: 200 },
            ),
          );
        }
        if (u.includes('/merchant/profile/')) {
          profileCallCount += 1;
          // First two calls (concurrent) return 401; retries (after refresh) return 200
          if (profileCallCount <= 2) {
            return Promise.resolve(new Response('', { status: 401 }));
          }
          return Promise.resolve(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
        }
        return Promise.reject(new Error('unexpected url'));
      });

      const p1 = fetchAPI('/merchant/profile/', { method: 'GET' });
      const p2 = fetchAPI('/merchant/profile/', { method: 'GET' });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(getAccessToken()).toBe('new-access');
      expect(fetchSpy).toHaveBeenCalledWith(
        `${apiUrl}/token/refresh/`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refresh_token: 'old-refresh' }),
        }),
      );
      fetchSpy.mockRestore();
    });

    it('on 401 and refresh failure, clears tokens and throws AuthenticationError', async () => {
      await saveTokens('old-access', 'old-refresh');

      jest.spyOn(global, 'fetch').mockImplementation((url: string | URL) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u.includes('/token/refresh/')) {
          return Promise.resolve(new Response('{}', { status: 400 }));
        }
        return Promise.resolve(new Response('', { status: 401 }));
      });

      await expect(fetchAPI('/merchant/profile/', { method: 'GET' })).rejects.toThrow(
        AuthenticationError,
      );
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('authAPI.login', () => {
    it('on success saves tokens and returns user data', async () => {
      const payload = {
        access_token: 'login-access',
        refresh_token: 'login-refresh',
        user_id: 42,
        message: 'OK',
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

      const data = await authAPI.login('merchant@example.com', 'password');

      expect(data).toMatchObject({
        access_token: 'login-access',
        refresh_token: 'login-refresh',
        user_id: 42,
      });
      expect(getAccessToken()).toBe('login-access');
    });
  });

  describe('authAPI.register', () => {
    it('calls register endpoint with formData and returns response', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ verification_required: true }), { status: 201 }),
        );

      const result = await authAPI.register({
        email: 'new@example.com',
        password: 'secret',
        user_type: 'merchant',
        phone: '+886912345678',
      });

      expect(result).toEqual({ verification_required: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/register/'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('new@example.com'),
        }),
      );
    });
  });

  describe('merchantAPI', () => {
    it('getProfile returns parsed MerchantProfileResponse', async () => {
      await saveTokens('token', 'refresh');
      const profile = {
        merchant: { id: 1, email: 'm@example.com' },
        store: { id: 1, name: 'My Store' },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));

      const result = await merchantAPI.getProfile();

      expect(result).toEqual(profile);
    });

    it('getStatistics returns parsed MerchantStatisticsResponse', async () => {
      await saveTokens('token', 'refresh');
      const stats = {
        active_coupons: 5,
        total_redemptions: 10,
        total_views: 100,
        today_cost: 0,
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(stats), { status: 200 }));

      const result = await merchantAPI.getStatistics();

      expect(result).toEqual(stats);
    });

    it('listTemplates returns parsed list', async () => {
      await saveTokens('token', 'refresh');
      const list = [{ id: 1, coupon_name: 'A' }];
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(list), { status: 200 }));

      const result = await merchantAPI.listTemplates();

      expect(result).toEqual(list);
    });
  });

  describe('accountDeletionAPI', () => {
    it('preDeleteCheck returns PreDeleteCheckResponse', async () => {
      await saveTokens('token', 'refresh');
      const check = {
        can_delete: true,
        warnings: [],
        data_summary: {
          active_coupons_count: 0,
          stores_count: 1,
          total_redemptions: 0,
          pending_transactions: 0,
        },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(check), { status: 200 }));

      const result = await accountDeletionAPI.preDeleteCheck();

      expect(result).toEqual(check);
    });

    it('getDeletionStatus returns DeletionStatusResponse', async () => {
      await saveTokens('token', 'refresh');
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ status: 'none' }), { status: 200 }));

      const result = await accountDeletionAPI.getDeletionStatus();

      expect(result).toMatchObject({ status: 'none' });
    });
  });

  describe('parseResponse + fetchAPI flow', () => {
    it('fetchAPI then parseResponse returns typed data', async () => {
      await saveTokens('token', 'refresh');
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 1, email: 'u@ex.com' }), { status: 200 }),
        );

      const response = await fetchAPI('/user-info/');
      const data = await parseResponse<{ id: number; email: string }>(response);

      expect(data).toEqual({ id: 1, email: 'u@ex.com' });
    });
  });
});
