import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { login as apiLogin, logout as apiLogout, verifyOtp } from '../services/api/auth';
import { getProfile } from '../services/api/profile';
import type { UserProfile } from '../services/api/profile';
import { clearTokens, getAccessToken, setTokens } from '../services/auth/tokenStore';

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

  // Restore session from stored token on mount
  useEffect(() => {
    let cancelled = false;

    async function restoreSession(): Promise<void> {
      try {
        const token = await getAccessToken();
        if (!token) {
          return;
        }

        const profile = await getProfile();
        if (!cancelled) {
          setUser(profile);
        }
      } catch {
        // Token is invalid or expired — clear it silently
        await clearTokens().catch(() => undefined);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (
    email: string | undefined,
    phone: string | undefined,
    password: string,
  ): Promise<void> => {
    const response = await apiLogin(email, phone, password);
    await setTokens(response.access, response.refresh);
    setUser(response.user);
  }, []);

  const loginWithOtp = useCallback(async (phone: string, code: string): Promise<void> => {
    const response = await verifyOtp(phone, code);
    await setTokens(response.access, response.refresh);
    setUser(response.user);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // Always clear local state and tokens. apiLogout handles the server-side
    // session invalidation and also calls clearTokens internally, but we call
    // it here as well so the UI clears immediately even if the API call fails.
    setUser(null);
    await Promise.allSettled([apiLogout(), clearTokens()]);
  }, []);

  const refreshAuth = useCallback(async (): Promise<void> => {
    try {
      const profile = await getProfile();
      setUser(profile);
    } catch {
      setUser(null);
      await clearTokens().catch(() => undefined);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      loginWithOtp,
      logout,
      refreshAuth,
    }),
    [user, isLoading, login, loginWithOtp, logout, refreshAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
