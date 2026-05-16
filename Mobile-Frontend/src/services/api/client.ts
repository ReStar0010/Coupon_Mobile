import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../auth/tokenStore';
import { normalizeError } from './errors';

// Lazy import to avoid circular dependency — auth.ts also imports client.ts
// We use a dynamic require at call time inside the interceptor.
type RefreshTokenFn = (refresh: string) => Promise<{ access: string; refresh: string }>;

// Hardcoded to staging for refactor/frontend → dev push. Restore env-var read
// before promoting to prod.
const BASE_URL = 'https://coupon-mobile-dev.onrender.com';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------- Request interceptor ----------
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ---------- Response interceptor ----------
// Single in-flight refresh promise to prevent race conditions.
let refreshPromise: Promise<{ access: string; refresh: string }> | null = null;
// Guard against multiple router.replace calls when concurrent 401 waiters all fail.
let redirecting = false;

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined;

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(normalizeError(error));
    }

    // Second 401 after retry — give up, clear session, navigate to login
    if (originalRequest._retry) {
      await clearTokens();
      if (!redirecting) { redirecting = true; router.replace('/(auth)/login' as never); }
      return Promise.reject(normalizeError(error));
    }

    originalRequest._retry = true;

    try {
      // Coalesce concurrent refresh calls into a single in-flight promise.
      // IMPORTANT: refreshPromise must be assigned synchronously (before any
      // await) so that a second concurrent 401 sees it and piggybacks on the
      // same request instead of issuing a duplicate refresh.
      if (!refreshPromise) {
        const refreshFn: RefreshTokenFn = (
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('./auth') as { refreshToken: RefreshTokenFn }
        ).refreshToken;

        refreshPromise = (async () => {
          const storedRefresh = await getRefreshToken();
          if (!storedRefresh) {
            await clearTokens();
            if (!redirecting) { redirecting = true; router.replace('/(auth)/login' as never); }
            throw normalizeError(error);
          }
          return refreshFn(storedRefresh);
        })().finally(() => {
          refreshPromise = null;
        });
      }

      const tokens = await refreshPromise;
      redirecting = false;
      await setTokens(tokens.access, tokens.refresh);

      const newToken = await getAccessToken();
      if (newToken) {
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      }

      return apiClient.request(originalRequest);
    } catch {
      await clearTokens();
      if (!redirecting) { redirecting = true; router.replace('/(auth)/login' as never); }
      return Promise.reject(normalizeError(error));
    }
  },
);
