import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from './providers/SessionProvider';
import { getRefreshToken } from '@/app/utils/authAPI';
import { devLog } from '@/app/utils/devLogger';

/**
 * Global authentication redirect handler
 * Monitors auth state and redirects to login when authentication fails
 * This serves as a safety net for cases where individual hooks might miss auth failures
 */
export default function AuthRedirectHandler() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    // Don't redirect while loading or if already authenticated
    if (loading || isAuthenticated) {
      return;
    }

    // Get current route path from segments
    const currentPath = '/' + segments.join('/');
    
    // Don't redirect if already on login page or index page
    const publicRoutes = ['/Login', '/', '/index'];
    const isPublicRoute = publicRoutes.some(route => currentPath === route || currentPath.startsWith(route));

    if (isPublicRoute) {
      return;
    }

    // Double-check with token storage as a failsafe
    // If tokens exist but isAuthenticated is false, it might be a temporary state
    // We'll let the individual hooks handle the redirect in that case
    const checkTokens = async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        devLog('AuthRedirectHandler: No tokens found, redirecting to login');
        router.replace('/Login');
      }
    };

    checkTokens();
  }, [isAuthenticated, loading, segments, router]);

  return null; // This component doesn't render anything
}
