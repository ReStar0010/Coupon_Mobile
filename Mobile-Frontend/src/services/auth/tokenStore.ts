import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(ACCESS_TOKEN_KEY, access),
    AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
    AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
  ]);
}

/**
 * Exchange the stored refresh token for a fresh access/refresh pair and
 * persist the result. Returns the new access token. Throws if there is no
 * stored refresh token or if the backend rejects the refresh.
 *
 * The axios HTTP client (`services/api/client.ts`) runs its own coalesced
 * refresh on a 401 response. This helper exists for callers outside the
 * HTTP path — specifically the WebSocket layer (`useCoopRoom`), which
 * can't piggyback on the axios interceptor. The two paths are independent:
 * if both fire concurrently, simplejwt's blacklist-after-rotation causes
 * the second one to fail; behaviour-correct, only slightly wasteful.
 */
export async function refreshTokens(): Promise<string> {
  const refresh = await getRefreshToken();
  if (!refresh) {
    throw new Error('no_stored_refresh_token');
  }
  // Lazy require to break the cycle: api/auth.ts → api/client.ts →
  // tokenStore.ts → api/auth.ts. Top-level import would fail to resolve.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { refreshToken } = require('../api/auth') as {
    refreshToken: (r: string) => Promise<{ access: string; refresh: string }>;
  };
  const next = await refreshToken(refresh);
  await setTokens(next.access, next.refresh);
  return next.access;
}
