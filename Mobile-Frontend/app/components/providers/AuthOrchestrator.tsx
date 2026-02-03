/**
 * AuthOrchestrator - Central auth event handler with navigation
 *
 * This component listens to auth events and handles navigation centrally,
 * preventing scattered redirect logic throughout the app.
 *
 * Responsibilities:
 * - Subscribe to AUTH_FAILURE events → redirect to Login
 * - Subscribe to LOGOUT_REQUESTED events → redirect to Login
 * - Prevent redirect loops by checking current route
 * - Sync auth state after events via refreshAuth()
 */

import React, { useEffect, useRef } from 'react';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { authEvents, AUTH_EVENT_TYPES, AuthEvent } from '@/app/utils/authEvents';
import { useAuth } from './SessionProvider';
import { devLog } from '@/app/utils/devLogger';

interface AuthOrchestratorProps {
  children: React.ReactNode;
}

const AuthOrchestrator: React.FC<AuthOrchestratorProps> = ({ children }) => {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { refreshAuth } = useAuth();

  // Use ref to track if we're already handling an auth failure
  // This prevents multiple rapid redirects
  const isHandlingAuthFailure = useRef(false);

  useEffect(() => {
    /**
     * Handle auth failure events
     * Redirects to login and refreshes auth state
     */
    const handleAuthFailure = (event: AuthEvent) => {
      // Prevent multiple simultaneous redirects
      if (isHandlingAuthFailure.current) {
        devLog('Auth failure already being handled, skipping');
        return;
      }

      devLog('Auth failure detected:', event.reason);

      // Check if already on login page to avoid redirect loops
      const isOnLoginPage = pathname === '/(auth)/login' || segments.includes('(auth)');
      const isOnResetPassword = pathname?.startsWith('/(auth)/reset-password');
      const isOnPublicRoute = isOnLoginPage || isOnResetPassword;

      if (isOnPublicRoute) {
        devLog('Already on public route, skipping redirect');
        // Still refresh auth state to sync UI
        refreshAuth();
        return;
      }

      isHandlingAuthFailure.current = true;

      // Build return URL for post-login redirect
      const returnUrl = event.returnUrl || pathname || '/(tabs)/easyuse';

      devLog('Redirecting to login with returnUrl:', returnUrl);

      // Navigate to login
      // Using replace to prevent back navigation to protected pages
      if (returnUrl && returnUrl !== '/(auth)/login' && returnUrl !== '/') {
        router.replace(`/(auth)/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      } else {
        router.replace('/(auth)/login');
      }

      // Refresh auth state to sync context
      refreshAuth();

      // Reset handling flag after a delay
      setTimeout(() => {
        isHandlingAuthFailure.current = false;
      }, 1000);
    };

    /**
     * Handle logout requested events
     * User-initiated logout - redirect to login without returnUrl
     */
    const handleLogoutRequested = () => {
      devLog('Logout requested, redirecting to login');

      // Navigate to login (no returnUrl for explicit logout)
      router.replace('/(auth)/login');

      // Refresh auth state
      refreshAuth();
    };

    // Subscribe to auth events
    const unsubscribeAuthFailure = authEvents.subscribe(
      AUTH_EVENT_TYPES.AUTH_FAILURE,
      handleAuthFailure
    );

    const unsubscribeLogout = authEvents.subscribe(
      AUTH_EVENT_TYPES.LOGOUT_REQUESTED,
      handleLogoutRequested
    );

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeAuthFailure();
      unsubscribeLogout();
    };
  }, [router, segments, pathname, refreshAuth]);

  return <>{children}</>;
};

export default AuthOrchestrator;
