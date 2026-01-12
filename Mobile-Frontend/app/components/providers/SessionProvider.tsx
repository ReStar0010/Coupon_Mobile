'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { devDebug } from '../../utils/devLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create an authentication context
// Minimal context - only tracks authentication state, not user details
type AuthContextType = {
  isAuthenticated: boolean;
  loading: boolean;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  loading: true,
  refreshAuth: async () => {},
});

// Custom hook to use the authentication context
export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authState, setAuthState] = useState<AuthContextType>({
    isAuthenticated: false,
    loading: true,
    refreshAuth: async () => {},
  });

  // Function to check authentication status
  // Single source of truth: refresh_token presence = authenticated
  const checkAuth = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      const hasRefreshToken = refreshToken !== null && refreshToken.length > 0;

      devDebug('Auth check:', {
        authenticated: hasRefreshToken,
        platform: 'React Native',
      });

      setAuthState((prevState) => ({
        ...prevState,
        isAuthenticated: hasRefreshToken,
        loading: false,
      }));
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthState((prevState) => ({
        ...prevState,
        isAuthenticated: false,
        loading: false,
      }));
    }
  };

  // Function to manually refresh auth state
  const refreshAuth = async () => {
    setAuthState((prevState) => ({
      ...prevState,
      loading: true,
    }));
    await checkAuth();
  };

  useEffect(() => {
    let isMounted = true;

    // Check authentication status on component mount
    const initializeAuth = async () => {
      if (isMounted) {
        await checkAuth();
      }
    };

    initializeAuth();

    // Set up an interval to periodically check auth status
    const interval = setInterval(async () => {
      if (isMounted) {
        await checkAuth();
      }
    }, 60000); // Check every minute

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Update the authState to include the refreshAuth function
  const contextValue: AuthContextType = {
    ...authState,
    refreshAuth,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
