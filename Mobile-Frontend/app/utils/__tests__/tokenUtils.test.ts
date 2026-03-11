/**
 * Unit tests for tokenUtils - token storage, JWT decode, init/migration
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import {
  STORAGE_KEYS,
  initStorage,
  storeTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getTokenState,
  hasValidRefreshToken,
  checkHasValidRefreshToken,
  decodeJwtPayload,
  isTokenExpired,
  getTokenExpiration,
  getTokenTimeRemaining,
  type DecodedToken,
} from '../tokenUtils';

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('tokenUtils', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
    await clearTokens();
  });

  describe('STORAGE_KEYS', () => {
    it('exports access and refresh token keys', () => {
      expect(STORAGE_KEYS.ACCESS_TOKEN).toBe('access_token');
      expect(STORAGE_KEYS.REFRESH_TOKEN).toBe('refresh_token');
      expect(STORAGE_KEYS.LEGACY_KEYS).toContain('user_id');
    });
  });

  describe('initStorage', () => {
    it('loads tokens from SecureStore into memory', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('access-123')
        .mockResolvedValueOnce('refresh-456');

      await initStorage();

      expect(getAccessToken()).toBe('access-123');
      expect(getRefreshToken()).toBe('refresh-456');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
    });

    it('when SecureStore is empty, migrates from AsyncStorage and writes to SecureStore', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('legacy-access')
        .mockResolvedValueOnce('legacy-refresh');

      await initStorage();

      expect(getAccessToken()).toBe('legacy-access');
      expect(getRefreshToken()).toBe('legacy-refresh');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCESS_TOKEN,
        'legacy-access',
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.REFRESH_TOKEN,
        'legacy-refresh',
      );
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
      ]);
    });

    it('when both SecureStore and AsyncStorage are empty, memory stays null', async () => {
      await initStorage();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('on SecureStore error, does not throw and reports to Sentry', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('SecureStore error'));

      await initStorage();

      expect(Sentry.captureException).toHaveBeenCalled();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });
  });

  describe('storeTokens', () => {
    it('updates in-memory cache and persists to SecureStore', async () => {
      await storeTokens('new-access', 'new-refresh');

      expect(getAccessToken()).toBe('new-access');
      expect(getRefreshToken()).toBe('new-refresh');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCESS_TOKEN,
        'new-access',
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.REFRESH_TOKEN,
        'new-refresh',
      );
    });

    it('on SecureStore setItem error, still updates memory and reports to Sentry', async () => {
      mockSecureStore.setItemAsync.mockRejectedValue(new Error('write failed'));

      await storeTokens('mem-access', 'mem-refresh');

      expect(getAccessToken()).toBe('mem-access');
      expect(getRefreshToken()).toBe('mem-refresh');
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('clearTokens', () => {
    it('clears in-memory and SecureStore, and legacy AsyncStorage keys', async () => {
      await storeTokens('a', 'r');
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

      await clearTokens();

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(STORAGE_KEYS.LEGACY_KEYS);
    });

    it('on SecureStore delete error, still clears memory and reports to Sentry', async () => {
      await storeTokens('a', 'r');
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('delete failed'));

      await clearTokens();

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('getTokenState', () => {
    it('returns access/refresh and exp from decoded JWTs', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const accessJwt = makeJwt({ exp });
      const refreshJwt = makeJwt({ exp: exp + 86400 });
      await storeTokens(accessJwt, refreshJwt);

      const state = getTokenState();

      expect(state.accessToken).toBe(accessJwt);
      expect(state.refreshToken).toBe(refreshJwt);
      expect(state.accessTokenExp).toBe(exp);
      expect(state.refreshTokenExp).toBe(exp + 86400);
    });
  });

  describe('hasValidRefreshToken', () => {
    it('returns true when refresh token exists and non-empty', async () => {
      await storeTokens('any', 'refresh');
      expect(hasValidRefreshToken()).toBe(true);
    });

    it('returns false when refresh token is null or empty', async () => {
      await clearTokens();
      expect(hasValidRefreshToken()).toBe(false);
    });
  });

  describe('checkHasValidRefreshToken', () => {
    it('calls initStorage then returns hasValidRefreshToken', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      const result = await checkHasValidRefreshToken();
      expect(result).toBe(false);
      expect(mockSecureStore.getItemAsync).toHaveBeenCalled();
    });

    it('returns true when refresh token exists after init', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('access')
        .mockResolvedValueOnce('refresh');
      const result = await checkHasValidRefreshToken();
      expect(result).toBe(true);
    });
  });

  describe('decodeJwtPayload', () => {
    it('decodes valid JWT and returns payload with exp/iat', () => {
      const payload = { exp: 999, iat: 100, user_id: 1 };
      const token = makeJwt(payload);
      const decoded = decodeJwtPayload(token);
      expect(decoded).toEqual(expect.objectContaining({ exp: 999, iat: 100, user_id: 1 }));
    });

    it('handles base64url padding (minus and underscore)', () => {
      const payload = { exp: 1 };
      const token = makeJwt(payload);
      expect(decodeJwtPayload(token)).toEqual(expect.objectContaining({ exp: 1 }));
    });

    it('returns null for non-3-part string', () => {
      expect(decodeJwtPayload('one')).toBeNull();
      expect(decodeJwtPayload('a.b')).toBeNull();
    });

    it('returns null for invalid base64 payload', () => {
      expect(decodeJwtPayload('a.!!!.c')).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('returns false when token exp is in the future (with buffer)', () => {
      const exp = Math.floor(Date.now() / 1000) + 120;
      const token = makeJwt({ exp });
      expect(isTokenExpired(token, 60)).toBe(false);
    });

    it('returns true when token exp is within buffer seconds', () => {
      const exp = Math.floor(Date.now() / 1000) + 30;
      const token = makeJwt({ exp });
      expect(isTokenExpired(token, 60)).toBe(true);
    });

    it('returns null when token cannot be decoded', () => {
      expect(isTokenExpired('not-a-jwt', 60)).toBeNull();
    });
  });

  describe('getTokenExpiration', () => {
    it('returns exp from decoded JWT', () => {
      const token = makeJwt({ exp: 12345 });
      expect(getTokenExpiration(token)).toBe(12345);
    });

    it('returns null when decode fails', () => {
      expect(getTokenExpiration('x')).toBeNull();
    });
  });

  describe('getTokenTimeRemaining', () => {
    it('returns seconds until exp', () => {
      const exp = Math.floor(Date.now() / 1000) + 100;
      const token = makeJwt({ exp });
      const remaining = getTokenTimeRemaining(token);
      expect(remaining).toBeGreaterThanOrEqual(98);
      expect(remaining).toBeLessThanOrEqual(101);
    });

    it('returns null when decode fails', () => {
      expect(getTokenTimeRemaining('x')).toBeNull();
    });
  });
});

function makeJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64 = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64(header)}.${b64(payload)}.signature`;
}
