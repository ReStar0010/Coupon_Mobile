/**
 * Integration tests for authAPI - fetchAPI + 401 queue + refresh, refresh failure
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initStorage, clearTokens, storeTokens } from '../tokenUtils';
import { authEvents, AUTH_EVENT_TYPES } from '../authEvents';
import { fetchAPI, refreshAccessToken } from '../authAPI';

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

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

describe('authAPI (integration)', () => {
  const API_BASE = 'https://test-api.example.com/api';

  beforeEach(async () => {
    jest.clearAllMocks();
    authEvents.clear();
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
    await clearTokens();
  });

  describe('fetchAPI + 401 queue + refresh', () => {
    it('queues request on 401, refreshes once, retries with new token and resolves', async () => {
      // 1) Seed tokens so refresh has something to send
      await storeTokens('old-access', 'old-refresh');

      // 2) Refresh endpoint returns new tokens
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((url: string | URL) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u.includes('/token/refresh/')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'NEW_ACCESS',
                refresh_token: 'NEW_REFRESH',
              }),
          } as Response);
        }
        return Promise.reject(new Error('unexpected fetch'));
      });

      // 3) Axios: without Bearer NEW_ACCESS -> 401; with Bearer NEW_ACCESS -> success
      (axios as jest.Mock).mockImplementation((url: string, config: { headers?: { Authorization?: string } }) => {
        const auth = config?.headers?.Authorization;
        if (auth === 'Bearer NEW_ACCESS') {
          return Promise.resolve({
            data: { ok: true },
            status: 200,
            headers: {},
            config: {},
          });
        }
        return Promise.reject({
          isAxiosError: true,
          response: { status: 401 },
        });
      });

      const p1 = fetchAPI('/user-info/', { method: 'GET' });
      const p2 = fetchAPI('/user-info/', { method: 'GET' });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r1.data).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE}/token/refresh/`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refresh_token: 'old-refresh' }),
        }),
      );
      fetchSpy.mockRestore();
    });

    it('on refresh failure, queued requests are rejected and AUTH_FAILURE is emitted', async () => {
      await storeTokens('old-access', 'old-refresh');

      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((url: string | URL) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u.includes('/token/refresh/')) {
          return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
        }
        return Promise.reject(new Error('unexpected fetch'));
      });

      (axios as jest.Mock).mockRejectedValue({
        isAxiosError: true,
        response: { status: 401 },
      });

      const listeners: Array<{ type: string; event: unknown }> = [];
      authEvents.subscribe(AUTH_EVENT_TYPES.AUTH_FAILURE, (event) => {
        listeners.push({ type: event.type, event });
      });

      const p = fetchAPI('/user-info/', { method: 'GET' });

      await expect(p).rejects.toThrow('Request failed');
      expect(listeners).toHaveLength(1);
      expect(listeners[0].event).toMatchObject({
        type: 'AUTH_FAILURE',
        reason: 'refresh_failed',
      });
      fetchSpy.mockRestore();
    });
  });
});
