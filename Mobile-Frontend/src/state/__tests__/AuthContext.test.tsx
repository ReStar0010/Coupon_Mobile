import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockLogin = jest.fn();
const mockLogoutApi = jest.fn();
const mockVerifyOtp = jest.fn();
const mockRegisterWithPhone = jest.fn();

jest.mock('../../services/api/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  logout: () => mockLogoutApi(),
  verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
  registerWithPhone: (...args: unknown[]) => mockRegisterWithPhone(...args),
  requestOtp: jest.fn(),
  sendRegistrationOtp: jest.fn(),
  refreshToken: jest.fn(),
}));

const mockGetAccessToken = jest.fn<Promise<string | null>, []>();
const mockClearTokens = jest.fn<Promise<void>, []>();
const mockSetTokensFn = jest.fn<Promise<void>, [string, string]>();

jest.mock('../../services/auth/tokenStore', () => ({
  getAccessToken: () => mockGetAccessToken(),
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setTokens: (a: string, r: string) => mockSetTokensFn(a, r),
  clearTokens: () => mockClearTokens(),
}));

const mockGetProfile = jest.fn();
jest.mock('../../services/api/profile', () => ({
  getProfile: () => mockGetProfile(),
}));

const mockResetInterceptorState = jest.fn();
jest.mock('../../services/api/client', () => ({
  resetInterceptorState: () => mockResetInterceptorState(),
}));

const mockAnalyticsTrack = jest.fn();
const mockAnalyticsIdentify = jest.fn();
const mockAnalyticsReset = jest.fn();
jest.mock('../../services/analytics/posthog', () => ({
  track: (...args: unknown[]) => mockAnalyticsTrack(...args),
  identify: (...args: unknown[]) => mockAnalyticsIdentify(...args),
  reset: () => mockAnalyticsReset(),
}));

import { AuthProvider, useAuth } from '../AuthContext';

function TestComponent() {
  const { isAuthenticated, user, isLoading } = useAuth();
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="authenticated">{String(isAuthenticated)}</Text>
      <Text testID="email">{user?.email ?? 'none'}</Text>
    </>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearTokens.mockResolvedValue(undefined);
    mockSetTokensFn.mockResolvedValue(undefined);
    mockLogoutApi.mockResolvedValue(undefined);
    mockGetProfile.mockResolvedValue({
      id: '1',
      email: 'user@example.com',
      phoneVerified: false,
    });
  });

  describe('initial state', () => {
    it('is not authenticated when no stored token', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      const { getByTestId } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('authenticated').props.children).toBe('false');
      expect(getByTestId('email').props.children).toBe('none');
    });

    it('discards a late getProfile result after the boot timeout has fired', async () => {
      // The component remains mounted while app/index.tsx redirects to login,
      // so a stale `setUser` would silently re-auth a user we just bounced.
      mockGetAccessToken.mockResolvedValue('stored-token');
      let resolveProfile!: (value: { id: string; email: string; phoneVerified: boolean }) => void;
      mockGetProfile.mockImplementation(
        () =>
          new Promise((res) => {
            resolveProfile = res;
          }),
      );

      jest.useFakeTimers();
      try {
        const { getByTestId } = render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>,
        );

        // Timeout fires first — user is bounced.
        await act(async () => {
          await jest.advanceTimersByTimeAsync(5_500);
        });
        expect(getByTestId('authenticated').props.children).toBe('false');

        // Late winner — the network resolved after we already gave up.
        await act(async () => {
          resolveProfile({ id: '99', email: 'late@example.com', phoneVerified: false });
          // Let microtasks drain so the dropped setUser would happen if the
          // guard were missing.
          await Promise.resolve();
          await Promise.resolve();
        });

        // Still unauthenticated — the late result must be discarded.
        expect(getByTestId('authenticated').props.children).toBe('false');
        expect(getByTestId('email').props.children).toBe('none');
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not clear freshly-set tokens when bootstrap fires after login', async () => {
      // Reproduces the "have to press login twice" bug. Sequence:
      //  1. App boots with a stale token; bootstrap's getProfile() hangs.
      //  2. User logs in successfully BEFORE the 5s timeout fires.
      //  3. The bootstrap's timeout fires — it must NOT clearTokens(),
      //     because login has already taken over as the source of truth.
      mockGetAccessToken.mockResolvedValue('stale-token');
      // First call (bootstrap) hangs forever. Second call (login flow) wins.
      mockGetProfile
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockResolvedValueOnce({
          id: '7',
          email: 'fresh@example.com',
          phoneVerified: false,
        });
      mockLogin.mockResolvedValue({
        access: 'new-access',
        refresh: 'new-refresh',
        user: undefined,
      });

      let authHook!: ReturnType<typeof useAuth>;
      function Capture() {
        authHook = useAuth();
        return null;
      }

      jest.useFakeTimers();
      try {
        const { getByTestId } = render(
          <AuthProvider>
            <Capture />
            <TestComponent />
          </AuthProvider>,
        );

        // Let bootstrap kick off (microtasks for getAccessToken + Promise.race
        // start), but don't advance past the deadline yet.
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });

        // User logs in mid-bootstrap.
        await act(async () => {
          await authHook.login('fresh@example.com', '', 'pw');
        });
        expect(getByTestId('authenticated').props.children).toBe('true');
        expect(getByTestId('email').props.children).toBe('fresh@example.com');

        const callsAfterLogin = mockClearTokens.mock.calls.length;

        // Now the boot timeout fires. Without the guard, restoreSession's
        // timeout branch would clearTokens() and silently log the user out
        // on the next API call.
        await act(async () => {
          await jest.advanceTimersByTimeAsync(5_500);
        });

        expect(getByTestId('authenticated').props.children).toBe('true');
        expect(getByTestId('email').props.children).toBe('fresh@example.com');
        // No additional clearTokens since login succeeded.
        expect(mockClearTokens).toHaveBeenCalledTimes(callsAfterLogin);
      } finally {
        jest.useRealTimers();
      }
    });

    it('flips isLoading=false within the timeout when getProfile hangs, preserving tokens', async () => {
      // Simulates a slow /api/profile/ response. The user should fall through
      // to the login screen rather than staring at the splash spinner for the
      // full 30s axios timeout, but the tokens must be PRESERVED — a slow
      // network is not an expired session, and the next launch on a healthy
      // network should auto-restore the user without a re-login.
      mockGetAccessToken.mockResolvedValue('stored-token');
      mockGetProfile.mockImplementation(() => new Promise(() => undefined));

      jest.useFakeTimers();
      try {
        const { getByTestId } = render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>,
        );

        // advanceTimersByTimeAsync flushes microtasks between timer firings,
        // so the `await getAccessToken()` + `await Promise.race(...)` chain
        // inside restoreSession resolves before we assert. Plain
        // advanceTimersByTime leaves microtasks pending and `waitFor` stalls
        // because its retry uses faked setTimeout.
        await act(async () => {
          await jest.advanceTimersByTimeAsync(5_500);
        });

        expect(getByTestId('loading').props.children).toBe('false');
        expect(getByTestId('authenticated').props.children).toBe('false');
        // Tokens must NOT be cleared on a timeout — the refresh interceptor
        // owns the "this session is dead" decision, not the bootstrap. A
        // future call (or the next app launch) gets a real chance to refresh.
        expect(mockClearTokens).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not clear tokens when getProfile rejects with a transient error', async () => {
      // Network blip, 5xx, parse error, etc. The interceptor only wipes
      // tokens on a 401-after-refresh-failure; the bootstrap must not race
      // ahead and clear them on every transient failure path.
      mockGetAccessToken.mockResolvedValue('stored-token');
      mockGetProfile.mockRejectedValue(new Error('Network request failed'));

      const { getByTestId } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('authenticated').props.children).toBe('false');
      expect(mockClearTokens).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('sets user after successful login', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      mockLogin.mockResolvedValue({
        access: 'access-token',
        refresh: 'refresh-token',
        user: { id: '1', email: 'user@example.com', phoneVerified: false },
      });

      let authHook!: ReturnType<typeof useAuth>;

      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(authHook.isLoading).toBe(false);
      });

      await act(async () => {
        await authHook.login('user@example.com', undefined, 'password');
      });

      expect(authHook.isAuthenticated).toBe(true);
      expect(authHook.user?.email).toBe('user@example.com');
    });
  });

  describe('registerWithPhone', () => {
    it('sets tokens, loads the profile, and flips isAuthenticated', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      mockRegisterWithPhone.mockResolvedValue({
        access: 'reg-access',
        refresh: 'reg-refresh',
      });
      mockGetProfile.mockResolvedValueOnce({
        id: '42',
        email: '',
        phoneVerified: true,
      });

      let authHook!: ReturnType<typeof useAuth>;
      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(authHook.isLoading).toBe(false);
      });

      await act(async () => {
        await authHook.registerWithPhone('0912345678', '123456', 'pw12345678');
      });

      expect(mockRegisterWithPhone).toHaveBeenCalledWith(
        '0912345678',
        '123456',
        'pw12345678',
      );
      expect(mockSetTokensFn).toHaveBeenCalledWith('reg-access', 'reg-refresh');
      expect(authHook.isAuthenticated).toBe(true);
      expect(authHook.user?.id).toBe('42');
    });
  });

  describe('analytics integration', () => {
    it('identifies the user and fires auth.login_completed on successful login', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      mockLogin.mockResolvedValue({
        access: 'a',
        refresh: 'r',
        user: { id: 'u-7', email: 'u@e.com', phoneVerified: false },
      });

      let authHook!: ReturnType<typeof useAuth>;
      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );
      await waitFor(() => expect(authHook.isLoading).toBe(false));

      await act(async () => {
        await authHook.login('u@e.com', undefined, 'pw');
      });

      expect(mockAnalyticsIdentify).toHaveBeenCalledWith('1', expect.any(Object));
      expect(mockAnalyticsTrack).toHaveBeenCalledWith(
        'auth.login_completed',
        expect.any(Object),
      );
    });

    it('resets analytics on logout', async () => {
      mockGetAccessToken.mockResolvedValue('t');

      let authHook!: ReturnType<typeof useAuth>;
      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );
      await waitFor(() => expect(authHook.isLoading).toBe(false));

      await act(async () => {
        await authHook.logout();
      });

      expect(mockAnalyticsReset).toHaveBeenCalledTimes(1);
      expect(mockAnalyticsTrack).toHaveBeenCalledWith(
        'auth.logout_completed',
        expect.any(Object),
      );
    });

    it('identifies on session restore so returning users do not appear as anonymous', async () => {
      // Bug caught by code review: without this, every reopened-app event
      // (coupon.viewed, spinner.draw_*, etc.) is attributed to an anonymous
      // PostHog distinct ID until the user manually logs out and back in.
      mockGetAccessToken.mockResolvedValue('stored-token');
      mockGetProfile.mockResolvedValueOnce({ id: 'u-99', email: '', phoneVerified: true });

      let authHook!: ReturnType<typeof useAuth>;
      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );

      await waitFor(() => expect(authHook.isAuthenticated).toBe(true));
      expect(mockAnalyticsIdentify).toHaveBeenCalledWith(
        'u-99',
        expect.any(Object),
      );
    });

    it('fires auth.signup_completed and identifies on registerWithPhone', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      mockRegisterWithPhone.mockResolvedValue({ access: 'a', refresh: 'r' });
      mockGetProfile.mockResolvedValueOnce({ id: '42', email: '', phoneVerified: true });

      let authHook!: ReturnType<typeof useAuth>;
      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );
      await waitFor(() => expect(authHook.isLoading).toBe(false));

      await act(async () => {
        await authHook.registerWithPhone('0912345678', '123456', 'pw');
      });

      expect(mockAnalyticsIdentify).toHaveBeenCalledWith('42', expect.any(Object));
      expect(mockAnalyticsTrack).toHaveBeenCalledWith(
        'auth.signup_completed',
        expect.any(Object),
      );
    });
  });

  describe('refreshAuth', () => {
    it('does not clear tokens on transient profile fetch failure', async () => {
      // Same anti-pattern the bootstrap was fixed for: a 5xx or network blip
      // during refreshAuth() must not wipe tokens. The response interceptor
      // owns the definitive 401-after-refresh-failure path; refreshAuth is
      // just a "pull latest profile" helper and should leave session state
      // untouched on transient errors.
      mockGetAccessToken.mockResolvedValue(null);
      mockLogin.mockResolvedValue({
        access: 'access',
        refresh: 'refresh',
        user: { id: '1', email: 'user@example.com', phoneVerified: false },
      });

      let authHook!: ReturnType<typeof useAuth>;
      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(authHook.isLoading).toBe(false);
      });

      // Authenticate first so we have a session to (not) wipe.
      await act(async () => {
        await authHook.login('user@example.com', undefined, 'password');
      });
      expect(authHook.isAuthenticated).toBe(true);
      const clearCallsBefore = mockClearTokens.mock.calls.length;

      // Simulate a transient backend hiccup on refreshAuth.
      mockGetProfile.mockRejectedValueOnce(new Error('Network request failed'));

      await act(async () => {
        await authHook.refreshAuth();
      });

      // Tokens preserved — user stays logged in despite the failed refresh.
      expect(mockClearTokens.mock.calls.length).toBe(clearCallsBefore);
      expect(authHook.isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    it('clears user and tokens on logout', async () => {
      // Start authenticated
      mockGetAccessToken.mockResolvedValue('existing-token');
      mockLogin.mockResolvedValue({
        access: 'access-token',
        refresh: 'refresh-token',
        user: { id: '1', email: 'user@example.com', phoneVerified: false },
      });

      let authHook!: ReturnType<typeof useAuth>;

      function Capture() {
        authHook = useAuth();
        return null;
      }

      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(authHook.isLoading).toBe(false);
      });

      await act(async () => {
        await authHook.login('user@example.com', undefined, 'password');
      });

      expect(authHook.isAuthenticated).toBe(true);

      await act(async () => {
        await authHook.logout();
      });

      expect(authHook.isAuthenticated).toBe(false);
      expect(authHook.user).toBeNull();
      expect(mockClearTokens).toHaveBeenCalled();
    });
  });
});
