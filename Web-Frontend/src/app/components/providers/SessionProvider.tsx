"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { isUserLoggedIn, getUserId } from "@/app/utils/authAPI";
import { devDebug } from "@/app/utils/devLogger";

// Create an authentication context
type AuthContextType = {
  isAuthenticated: boolean;
  userId: string | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userId: null,
  loading: true,
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
  });

  useEffect(() => {
    // Check authentication status on component mount
    const checkAuth = () => {
      const authenticated = isUserLoggedIn();
      const userId = getUserId();

      devDebug("Auth check:", {
        authenticated,
        userId,
        cookies: typeof document !== "undefined" ? document.cookie : "SSR",
      });

      setAuthState({
        isAuthenticated: authenticated,
        userId: userId,
        loading: false,
      });
    };

    checkAuth();

    // Set up an interval to periodically check auth status
    const interval = setInterval(checkAuth, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
  );
};

export default AuthProvider;
