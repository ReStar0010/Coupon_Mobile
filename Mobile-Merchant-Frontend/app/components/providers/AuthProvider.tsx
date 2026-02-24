import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initStorage } from '@/utils/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const redirectingRef = useRef(false);
  const lastCheckedPathname = useRef<string | null>(null);
  const lastProfilePathRef = useRef<string | null>(null);

  const checkAuth = async () => {
    try {
      // Initialize storage first to ensure tokens are loaded
      await initStorage();

      // Read directly from AsyncStorage to ensure we have the latest values
      // This is more reliable than using the in-memory tokenStorage
      const accessToken = await AsyncStorage.getItem('merchant_access_token');
      const refreshToken = await AsyncStorage.getItem('merchant_refresh_token');

      // User is authenticated if they have either access token or refresh token
      // If only refresh token exists, we can refresh the access token
      const isAuth = !!(accessToken || refreshToken);

      console.log('[AuthProvider] Auth check result:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        isAuthenticated: isAuth,
      });

      setIsAuthenticated(isAuth);
    } catch (error) {
      console.error('[AuthProvider] Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Helper function to check if a path is an auth route
  const isAuthRoutePath = (path: string): boolean => {
    if (!path) return false;
    const normalized = path.toLowerCase();
    return (
      normalized.includes('/(auth)/') ||
      normalized.includes('(auth)') ||
      normalized === '/(auth)/login' ||
      normalized === '/(auth)/register' ||
      normalized === '/(auth)/forgot-password' ||
      normalized === '/login' ||
      normalized === '/register' ||
      normalized === '/forgot-password' ||
      normalized.includes('/register') ||
      normalized.includes('/forgot-password') ||
      normalized.endsWith('/login') ||
      normalized.endsWith('/register') ||
      normalized.endsWith('/forgot-password')
    );
  };

  // Helper function to check if a path is a profile route
  const isProfileRoutePath = (path: string): boolean => {
    if (!path) return false;
    const normalized = path.toLowerCase();
    // Check for explicit profile routes
    if (
      normalized.includes('/(profile)/') ||
      normalized.includes('(profile)') ||
      normalized === '/(profile)/' ||
      normalized === '/(profile)/index' ||
      normalized === '/(profile)/edit' ||
      normalized === '/profile' ||
      normalized === '/profile/' ||
      normalized.startsWith('/profile/')
    ) {
      return true;
    }
    // Check if path is '/edit' and we were previously on a profile route
    // This handles expo-router's simplified paths
    if (normalized === '/edit') {
      const lastPath = lastCheckedPathname.current;
      if (
        lastPath &&
        (lastPath.includes('profile') ||
          lastPath === '/(profile)/' ||
          lastPath === '/(profile)/index' ||
          lastProfilePathRef.current !== null)
      ) {
        return true;
      }
    }
    // Also check if this path matches the last known profile path
    // This handles cases where expo-router uses simplified paths like '/edit'
    if (lastProfilePathRef.current && path === lastProfilePathRef.current) {
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (isLoading) return; // Don't redirect while checking auth status
    if (!pathname) return; // Wait for pathname to be available
    if (redirectingRef.current) {
      console.log('[AuthProvider] Already redirecting, skipping check');
      return; // Don't redirect if already redirecting
    }

    // Check if current pathname is an auth route (public route)
    const isAuthRoute = isAuthRoutePath(pathname);
    let isProfileRoute = isProfileRoutePath(pathname);

    // Special handling: if path is '/edit', always treat it as a profile route
    // since it's the profile edit page in the (profile) group
    if (!isProfileRoute && pathname === '/edit') {
      console.log('[AuthProvider] /edit path detected, treating as profile route');
      isProfileRoute = true;
      // Set tracking immediately
      lastProfilePathRef.current = pathname;
    }

    console.log('[AuthProvider] Route check:', {
      pathname,
      isAuthenticated,
      isLoading,
      isAuthRoute,
      isProfileRoute,
      lastProfilePath: lastProfilePathRef.current,
      redirecting: redirectingRef.current,
    });

    // If we're on a profile route and user is authenticated, allow it immediately
    if (isProfileRoute && isAuthenticated) {
      console.log('[AuthProvider] On profile route, allowing access - no redirect');
      lastCheckedPathname.current = pathname;
      // Track this as a profile path for future reference
      lastProfilePathRef.current = pathname;
      return; // Allow access to profile routes, don't set up any redirect logic
    }

    // Clear profile path tracking if we're navigating away from profile routes
    // (but not if we're going to root, as that might be a temporary navigation state)
    // Also don't clear if we're going to /edit (might be profile edit)
    if (
      !isProfileRoute &&
      pathname !== '/' &&
      pathname !== '/edit' &&
      lastProfilePathRef.current !== null
    ) {
      // Only clear if we're going to a completely different section (like coupons)
      if (pathname.includes('coupon') || pathname.includes('(coupons)')) {
        console.log('[AuthProvider] Clearing profile path tracking, navigating to coupons section');
        lastProfilePathRef.current = null;
      }
    }

    // If we're on an auth route and user is not authenticated, allow it immediately
    if (isAuthRoute && !isAuthenticated) {
      console.log('[AuthProvider] On auth route, allowing access - no redirect');
      lastCheckedPathname.current = pathname;
      return; // Allow access to auth routes, don't set up any redirect logic
    }

    // If we've already checked this pathname and it's an auth route, skip
    if (lastCheckedPathname.current === pathname && isAuthRoute) {
      console.log('[AuthProvider] Already checked this auth route, skipping');
      return;
    }

    // Mark this pathname as checked
    lastCheckedPathname.current = pathname;

    // Add a delay to allow route navigation to complete before checking protected routes
    const timeoutId = setTimeout(() => {
      // Re-check pathname in case it changed during navigation
      // Use the latest pathname from the closure
      const currentPath = pathname;
      const currentIsAuthRoute = isAuthRoutePath(currentPath);
      let currentIsProfileRoute = isProfileRoutePath(currentPath);

      // Special handling: if path is '/edit' and we were previously on a profile route,
      // treat it as a profile route
      if (
        !currentIsProfileRoute &&
        currentPath === '/edit' &&
        lastProfilePathRef.current !== null
      ) {
        console.log(
          '[AuthProvider] /edit path detected with previous profile context in delayed check',
        );
        currentIsProfileRoute = true;
      }

      // Also check: if path is '/edit' and we just came from a profile route
      if (!currentIsProfileRoute && currentPath === '/edit') {
        const lastPath = lastCheckedPathname.current;
        if (
          lastPath &&
          (lastPath.includes('profile') ||
            lastPath === '/(profile)/' ||
            lastPath === '/(profile)/index')
        ) {
          console.log('[AuthProvider] /edit path detected after profile route in delayed check');
          currentIsProfileRoute = true;
          // Set tracking immediately
          lastProfilePathRef.current = currentPath;
        }
      }

      console.log('[AuthProvider] Delayed check after navigation:', {
        currentPath,
        currentIsAuthRoute,
        currentIsProfileRoute,
        lastProfilePath: lastProfilePathRef.current,
        isAuthenticated,
      });

      // If we're on a profile route and authenticated, don't redirect (double check)
      if (currentIsProfileRoute && isAuthenticated) {
        console.log('[AuthProvider] Still on profile route after delay, allowing access');
        // Update profile path tracking
        if (currentPath !== lastProfilePathRef.current) {
          lastProfilePathRef.current = currentPath;
        }
        return;
      }

      // If we're on an auth route, don't redirect (double check)
      if (currentIsAuthRoute && !isAuthenticated) {
        console.log('[AuthProvider] Still on auth route after delay, allowing access');
        return;
      }

      // If user is not authenticated and trying to access protected route
      if (!isAuthenticated && !currentIsAuthRoute) {
        // Only redirect if not already on login page or root to avoid loops
        // Check both /login and /(auth)/login formats
        const isLoginPage =
          currentPath === '/(auth)/login' || currentPath === '/login' || currentPath === '/';
        if (!isLoginPage) {
          console.log('[AuthProvider] Redirecting to login from protected route:', currentPath);
          redirectingRef.current = true;
          router.replace('/(auth)/login');
          setTimeout(() => {
            redirectingRef.current = false;
          }, 1000);
        }
      }
      // If user is authenticated and on auth pages, redirect to main app
      else if (isAuthenticated && currentIsAuthRoute) {
        console.log('[AuthProvider] Redirecting authenticated user away from auth pages');
        redirectingRef.current = true;
        router.replace('/(coupons)/');
        setTimeout(() => {
          redirectingRef.current = false;
        }, 1000);
      }
      // If user is authenticated and on root, redirect to main app
      // But don't redirect if we're navigating to/from profile pages
      else if (isAuthenticated && currentPath === '/') {
        // Check if we should stay on profile page (if user was just on profile)
        // Use lastProfilePathRef to track if we were on a profile route
        const wasOnProfile = lastProfilePathRef.current !== null;

        // Also check if the last checked pathname was a profile route
        const lastPath = lastCheckedPathname.current;
        const lastPathWasProfile =
          lastPath &&
          (lastPath.includes('profile') ||
            lastPath === '/(profile)/' ||
            lastPath === '/(profile)/index' ||
            lastPath === '/(profile)/edit' ||
            lastPath === '/edit');

        if (wasOnProfile || lastPathWasProfile) {
          console.log(
            '[AuthProvider] User was on profile page, staying on root (likely navigating to profile)',
            {
              wasOnProfile,
              lastPathWasProfile,
              lastPath,
              lastProfilePath: lastProfilePathRef.current,
            },
          );
          // Don't redirect - this is likely a transient state during navigation to profile
          // Keep the profile path tracking
          lastProfilePathRef.current = lastPath || lastProfilePathRef.current;
        } else {
          console.log('[AuthProvider] Redirecting authenticated user from root');
          redirectingRef.current = true;
          router.replace('/(coupons)/');
          setTimeout(() => {
            redirectingRef.current = false;
          }, 1000);
        }
      }
    }, 200); // Delay to allow route navigation to complete

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isAuthenticated, isLoading, pathname, router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
