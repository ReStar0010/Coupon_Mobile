import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './providers/AuthProvider';
import { initStorage } from '@/utils/api';

/**
 * Global authentication redirect handler for Merchant Frontend
 * Monitors auth state and redirects to login when authentication fails
 * This serves as a safety net for cases where individual components might miss auth failures
 */
export default function AuthRedirectHandler() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) {
      return;
    }

    // If already authenticated, don't redirect
    if (isAuthenticated) {
      return;
    }

    // Get current route path from segments
    const currentPath = '/' + segments.join('/');
    
    // Don't redirect if already on login page or auth routes
    const publicRoutes = ['/(auth)/login', '/(auth)/register', '/(auth)/forgot-password', '/', '/index'];
    const isPublicRoute = publicRoutes.some(route => 
      currentPath === route || 
      currentPath.startsWith(route) ||
      currentPath.includes('(auth)')
    );

    if (isPublicRoute) {
      return;
    }

    // Double-check with token storage as a failsafe
    // If refresh token exists, user is authenticated (even if access token expired)
    // We should not redirect in this case
    const checkTokens = async () => {
      try {
        await initStorage();
        // Read directly from AsyncStorage for most reliable check
        const refreshToken = await AsyncStorage.getItem('merchant_refresh_token');
        
        // If refresh token exists, user is authenticated
        // Don't redirect - let the app try to refresh the access token
        if (refreshToken) {
          console.log('[AuthRedirectHandler] Refresh token found, user is authenticated, not redirecting');
          return;
        }
        
        // Only redirect if truly no tokens exist
        console.log('[AuthRedirectHandler] No tokens found, redirecting to login');
        router.replace('/(auth)/login');
      } catch (error) {
        console.error('[AuthRedirectHandler] Error checking tokens:', error);
        // Only redirect if we're sure there are no tokens
        router.replace('/(auth)/login');
      }
    };

    checkTokens();
  }, [isAuthenticated, isLoading, segments, router]);

  return null; // This component doesn't render anything
}
