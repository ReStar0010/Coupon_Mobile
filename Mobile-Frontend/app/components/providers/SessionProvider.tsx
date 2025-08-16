'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { isUserLoggedIn, getUserId } from '../../utils/authAPI';
import { devDebug } from '../../utils/devLogger';

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
      const authenticated = await isUserLoggedIn();
      const userId = await getUserId();

      devDebug('Auth check:', {
        authenticated,
        userId,
        platform: 'React Native',
      });

      setAuthState((prevState) => ({
        ...prevState,
        isAuthenticated: authenticated,
        userId: userId,
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
