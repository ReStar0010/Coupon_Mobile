'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { devDebug, devLog } from '../../utils/devLogger';
import { authEvents, AUTH_EVENT_TYPES } from '../../utils/authEvents';
import { initStorage, hasValidRefreshToken, clearTokens, getAccessToken } from '../../utils/tokenUtils';

/**
 * Authentication Context Type
 *
 * Minimal context - only tracks authentication state, not user details.
 * User info should be fetched from API when needed.
 */
type AuthContextType = {
  isAuthenticated: boolean;
  loading: boolean;
  refreshAuth: () => Promise<void>;
  forceLogout: (reason?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  loading: true,
  refreshAuth: async () => {},
  forceLogout: async () => {},
});

// Custom hook to use the authentication context
export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * Check authentication status
   * Single source of truth: refresh_token presence = authenticated
   *
   * IMPORTANT: Must call initStorage() first to load tokens from AsyncStorage into memory!
   */
  const checkAuth = useCallback(async () => {
    try {
      // Load tokens from AsyncStorage into memory cache
      await initStorage();

      // Now check token from memory (synchronous)
      const token = getAccessToken();
      const hasToken = !!token;

      devDebug('[AuthProvider] Auth check result:', {
        hasToken,
        isAuthenticated: hasToken,
      });

      setIsAuthenticated(hasToken);
      setLoading(false);
    } catch (error) {
      console.error('[AuthProvider] Auth check error:', error);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  /**
   * Manually refresh auth state
   * Called by AuthOrchestrator after handling auth events
   */
  const refreshAuth = useCallback(async () => {
    setLoading(true);
    await checkAuth();
  }, [checkAuth]);

  /**
   * Force logout - programmatically clear session
   * Emits AUTH_FAILURE event for AuthOrchestrator to handle navigation
   *
   * @param reason Optional reason for the logout
   */
  const forceLogout = useCallback(async (reason?: string) => {
    devLog('Force logout:', reason);
    await clearTokens();
    setIsAuthenticated(false);
    setLoading(false);
    authEvents.emit({
      type: AUTH_EVENT_TYPES.AUTH_FAILURE,
      reason: reason || 'force_logout',
    });
  }, []);

  // Initialize auth check on mount and subscribe to auth events
  useEffect(() => {
    // Initial auth check
    checkAuth();

    // Subscribe to SESSION_REFRESHED events to keep state in sync
    // This is emitted when tokens are stored (login) or refreshed
    const unsubscribe = authEvents.subscribe(
      AUTH_EVENT_TYPES.SESSION_REFRESHED,
      () => {
        devDebug('Session refreshed event received, updating auth state');
        checkAuth();
      }
    );

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [checkAuth]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: AuthContextType = {
    isAuthenticated,
    loading,
    refreshAuth,
    forceLogout,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
