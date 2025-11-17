'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { isUserLoggedIn, getUserId } from '../../utils/authAPI';
import { devDebug } from '../../utils/devLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create an authentication context
type AuthContextType = {
  isAuthenticated: boolean;
  userId: string | null;
  loading: boolean;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userId: null,
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
    userId: null,
    loading: true,
    refreshAuth: async () => {},
  });

  // Function to check authentication status
  const checkAuth = async () => {
    try {
      // Optimize: Use multiGet to fetch all values in a single AsyncStorage call
      const [isLoggedIn, refreshToken, userId] = await AsyncStorage.multiGet([
        'is_logged_in',
        'refresh_token',
        'user_id',
      ]);

      const authenticated = isLoggedIn[1] === 'true' || refreshToken[1] !== null;
      const userIdValue = userId[1];

      devDebug('Auth check:', {
        authenticated,
        userId: userIdValue,
        platform: 'React Native',
      });

      setAuthState((prevState) => ({
        ...prevState,
        isAuthenticated: authenticated,
        userId: userIdValue,
        loading: false,
      }));
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthState((prevState) => ({
        ...prevState,
        isAuthenticated: false,
        userId: null,
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
