import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { getAccessToken, initStorage } from '@/utils/api';

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

  const checkAuth = async () => {
    try {
      await initStorage();
      const token = getAccessToken();
      const isAuth = !!token;
      console.log('[AuthProvider] Auth check result:', {
        hasToken: !!token,
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

  useEffect(() => {
    if (isLoading) return; // Don't redirect while checking auth status
    if (!pathname) return; // Wait for pathname to be available
    if (redirectingRef.current) {
      console.log('[AuthProvider] Already redirecting, skipping check');
      return; // Don't redirect if already redirecting
    }

    // Check if current pathname is an auth route (public route)
    const isAuthRoute = isAuthRoutePath(pathname);

    console.log('[AuthProvider] Route check:', {
      pathname,
      isAuthenticated,
      isLoading,
      isAuthRoute,
      redirecting: redirectingRef.current,
    });

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

      console.log('[AuthProvider] Delayed check after navigation:', {
        currentPath,
        currentIsAuthRoute,
        isAuthenticated,
      });

      // If we're on an auth route, don't redirect (double check)
      if (currentIsAuthRoute && !isAuthenticated) {
        console.log('[AuthProvider] Still on auth route after delay, allowing access');
        return;
      }

      // If user is not authenticated and trying to access protected route
      if (!isAuthenticated && !currentIsAuthRoute) {
        // Only redirect if not already on login page or root to avoid loops
        // Check both /login and /(auth)/login formats
        const isLoginPage = currentPath === '/(auth)/login' || currentPath === '/login' || currentPath === '/';
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
      else if (isAuthenticated && currentPath === '/') {
        console.log('[AuthProvider] Redirecting authenticated user from root');
        redirectingRef.current = true;
        router.replace('/(coupons)/');
        setTimeout(() => {
          redirectingRef.current = false;
        }, 1000);
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

