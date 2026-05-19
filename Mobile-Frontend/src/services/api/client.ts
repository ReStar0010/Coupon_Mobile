import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../auth/tokenStore';
import { ApiRequestError, normalizeError } from './errors';

// Lazy import to avoid circular dependency — auth.ts also imports client.ts
// We use a dynamic require at call time inside the interceptor.
type RefreshTokenFn = (refresh: string) => Promise<{ access: string; refresh: string }>;

// Hardcoded to staging for refactor/frontend → dev push. Restore env-var read
// before promoting to prod.
const BASE_URL = 'https://coupon-mobile-dev.onrender.com';

// Endpoints whose 401 means "bad credentials" or "bad refresh token", NOT
// "access token expired". Running them through the refresh-and-retry flow
// is wrong: there's nothing to refresh during login, and refreshing a
// refresh-token call would recurse into the same interceptor (the old code
// could deadlock on `await refreshPromise` from inside the refresh request's
// own 401 handler). Reject these immediately so the caller's catch sees the
// real error message and the login screen can render it.
const AUTH_FREE_PATHS: readonly string[] = [
  '/api/login/',
  '/api/token/refresh/',
  '/api/register/send-otp/',
  '/api/register/verify-otp/',
  '/api/phone-otp/send/',
  '/api/phone-otp/verify/',
  '/api/forgot-password/',
  '/api/reset-password/',
  // Public version-info endpoint: must work pre-login so a stale
  // install can be told to upgrade before it tries to authenticate.
  '/api/app/version-info/',
];

function isAuthFreePath(url: string | undefined): boolean {
  if (!url) return false;
  // Exact match on the path portion. `endsWith` would let a future route
  // like `/admin/api/login/` silently bypass the refresh-and-retry flow.
  // Strip any query string defensively — none of the auth endpoints take
  // query params today but the cost is one split.
  const path = url.split('?')[0];
  return AUTH_FREE_PATHS.includes(path);
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------- Request interceptor ----------
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // AUTH_FREE_PATHS must go out anonymously. The Django backend's
  // JWTAuthentication runs on every request and raises InvalidToken (→ 401)
  // on an expired access token before the view runs — even for AllowAny
  // endpoints. Attaching the stored bearer to /api/token/refresh/ therefore
  // poisons the refresh flow: the BE rejects the request before reading the
  // refresh_token in the body, and the FE wipes a still-valid session. Same
  // hazard applies to /api/login/ on an app launch with a stale token in
  // storage (the historical "press login twice" symptom).
  if (isAuthFreePath(config.url)) {
    return config;
  }
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

/**
 * Reset interceptor module state. Call this from AuthContext after a fresh
 * login/registration succeeds, so that a later session-expiry in the same
 * app lifecycle still navigates to the login screen (the `redirecting` flag
 * stays `true` after a previous bounce until explicitly cleared). Also
 * exposed for test isolation — module-level state otherwise leaks between
 * tests.
 */
export function resetInterceptorState(): void {
  redirecting = false;
  refreshPromise = null;
}

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

    // Auth-free endpoints never need a token refresh — a 401 here is the
    // server's final answer (bad password, bad refresh, etc.). Surface it
    // unchanged so the calling screen can render the error.
    if (isAuthFreePath(originalRequest.url)) {
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
            throw new ApiRequestError('Session expired', 401);
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
    } catch (refreshError) {
      await clearTokens();
      if (!redirecting) { redirecting = true; router.replace('/(auth)/login' as never); }
      // Surface the refresh failure if there is one (e.g. the dedicated
      // "Session expired" above); fall back to the original 401 otherwise.
      return Promise.reject(normalizeError(refreshError ?? error));
    }
  },
);
