import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  registerWithPhone as apiRegisterWithPhone,
  verifyOtp,
} from '../services/api/auth';
import { resetInterceptorState } from '../services/api/client';
import { getProfile } from '../services/api/profile';
import type { UserProfile } from '../services/api/profile';
import { clearTokens, getAccessToken, setTokens } from '../services/auth/tokenStore';
import {
  identify as analyticsIdentify,
  reset as analyticsReset,
  track as analyticsTrack,
} from '../services/analytics/posthog';

// Boot deadline. The user opens the app expecting a fast first paint; if the
// stored-token /profile/ call doesn't return inside this budget we drop them
// on /login rather than holding the splash spinner for axios's 30s timeout.
// Tokens are PRESERVED across the timeout — the apiClient interceptor owns
// the "this session is dead" decision (a real 401-after-refresh-failure).
// A slow network is not an expired session; the next launch on a healthy
// network will auto-restore the user without a re-login.
const BOOT_TIMEOUT_MS = 5_000;

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (
    email: string | undefined,
    phone: string | undefined,
    password: string,
  ) => Promise<void>;
  loginWithOtp: (phone: string, code: string) => Promise<void>;
  registerWithPhone: (phone: string, code: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Flipped by login / loginWithOtp / logout once an authoritative auth action
  // begins. The bootstrap effect must skip every side effect (setUser, clearTokens,
  // setIsLoading) once this is true, otherwise a late-firing timeout/catch would
  // wipe freshly-minted login tokens — that was the "press login twice" bug.
  const bootSupersededRef = useRef(false);

  // Restore session from stored token on mount
  useEffect(() => {
    let cancelled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    // `superseded()` collapses three independent reasons to bail (unmount,
    // explicit auth action, late-winner race) into one decision so the four
    // side-effect sites below all read the same way.
    const superseded = (): boolean => cancelled || bootSupersededRef.current;

    async function restoreSession(): Promise<void> {
      let raced = false;
      try {
        const token = await getAccessToken();
        if (superseded() || !token) {
          return;
        }

        // Race the profile fetch against BOOT_TIMEOUT_MS. A sentinel symbol
        // keeps the type narrow without smuggling a special user shape.
        const timeoutSentinel = Symbol('boot-timeout');
        const timeoutPromise = new Promise<typeof timeoutSentinel>((resolve) => {
          timeoutHandle = setTimeout(() => {
            raced = true;
            resolve(timeoutSentinel);
          }, BOOT_TIMEOUT_MS);
        });
        const result = await Promise.race([getProfile(), timeoutPromise]);

        if (superseded()) {
          return;
        }

        if (result === timeoutSentinel) {
          // Slow path: fall through to the login screen with tokens intact.
          // The interceptor's refresh-and-retry path is the only place that
          // should wipe tokens — a timeout here just means "the network was
          // too slow this launch", which the next launch can recover from.
          return;
        }

        // Late-winner guard: the timeout already fired but getProfile resolved
        // after — drop the result, don't replay the bounced login.
        if (raced) {
          return;
        }

        setUser(result);
        // Re-identify on session restore — otherwise every event fired
        // during a reopened-app session (coupon.viewed, spinner.draw_*,
        // etc.) is attributed to an anonymous PostHog distinct ID until
        // the user explicitly logs out and back in.
        analyticsIdentify(result.id, { phoneVerified: result.phoneVerified });
      } catch {
        // Transient failure (network blip, 5xx, parse error). Do NOT clear
        // tokens — that's the interceptor's job, and only on a 401 that
        // survives the refresh-and-retry. If the failure here was actually
        // a definitive auth failure, the interceptor has already cleared
        // tokens and navigated to login; running clearTokens() again here
        // would also wipe valid tokens for every transient error path.
      } finally {
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
        }
        if (!superseded()) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    };
  }, []);

  const login = useCallback(async (
    email: string | undefined,
    phone: string | undefined,
    password: string,
  ): Promise<void> => {
    // From this point on, any still-running bootstrap must not touch auth state.
    bootSupersededRef.current = true;
    const { access, refresh } = await apiLogin(email, phone, password);
    await setTokens(access, refresh);
    // A previous session expiry in this app lifecycle may have left the
    // interceptor's `redirecting` flag latched — clear it so the next 401
    // can navigate back to login if this new session also expires.
    resetInterceptorState();
    // BE login returns tokens-only; pull the full profile via the
    // newly-authed apiClient.
    const profile = await getProfile();
    setUser(profile);
    // Bootstrap is now superseded and will skip its own setIsLoading(false);
    // do it here so the UI exits its splash state immediately.
    setIsLoading(false);
    analyticsIdentify(profile.id, { phoneVerified: profile.phoneVerified });
    analyticsTrack('auth.login_completed', { method: email ? 'email' : 'phone' });
  }, []);

  const loginWithOtp = useCallback(async (phone: string, code: string): Promise<void> => {
    bootSupersededRef.current = true;
    const response = await verifyOtp(phone, code);
    await setTokens(response.access, response.refresh);
    resetInterceptorState();
    // verifyOtp returns the user inline today; fall back to getProfile()
    // if the BE shape ever stops including it.
    let profile: UserProfile;
    if (response.user) {
      profile = response.user;
      setUser(profile);
    } else {
      profile = await getProfile();
      setUser(profile);
    }
    setIsLoading(false);
    analyticsIdentify(profile.id, { phoneVerified: profile.phoneVerified });
    analyticsTrack('auth.login_completed', { method: 'otp' });
  }, []);

  const registerWithPhone = useCallback(
    async (phone: string, code: string, password: string): Promise<void> => {
      bootSupersededRef.current = true;
      const { access, refresh } = await apiRegisterWithPhone(phone, code, password);
      await setTokens(access, refresh);
      resetInterceptorState();
      // BE register-verify returns tokens only; fetch the profile via the
      // newly-authed apiClient so the UI has user state immediately.
      const profile = await getProfile();
      setUser(profile);
      setIsLoading(false);
      analyticsIdentify(profile.id, { phoneVerified: profile.phoneVerified });
      analyticsTrack('auth.signup_completed', { method: 'phone_otp' });
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    // Same supersede semantic: a logout during a hung bootstrap must win.
    bootSupersededRef.current = true;
    // Always clear local state and tokens. apiLogout handles the server-side
    // session invalidation and also calls clearTokens internally, but we call
    // it here as well so the UI clears immediately even if the API call fails.
    setUser(null);
    setIsLoading(false);
    // Telemetry: fire BEFORE reset() so the event is still attributed to
    // the outgoing user's distinct id.
    analyticsTrack('auth.logout_completed', {});
    analyticsReset();
    await Promise.allSettled([apiLogout(), clearTokens()]);
  }, []);

  const refreshAuth = useCallback(async (): Promise<void> => {
    // "Pull latest profile" helper — not a session-validity check. The
    // response interceptor handles definitive 401-after-refresh-failure
    // (clear tokens + navigate to login); a transient 5xx or network blip
    // here must leave the session untouched. Swallowing the error keeps the
    // existing user state in place so the UI doesn't churn on a flaky tick.
    try {
      const profile = await getProfile();
      setUser(profile);
    } catch {
      // Intentional no-op: a failed refresh is not a logout signal.
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      loginWithOtp,
      registerWithPhone,
      logout,
      refreshAuth,
    }),
    [user, isLoading, login, loginWithOtp, registerWithPhone, logout, refreshAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
