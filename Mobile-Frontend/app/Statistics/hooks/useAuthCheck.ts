import { devDebug } from '../../utils/devLogger';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export const useAuthCheck = (isAuthenticated: boolean, authLoading: boolean) => {
  const router = useRouter();

  useEffect(() => {
    // Only check if useRequireAuth says we're not authenticated and not loading
    if (!authLoading && !isAuthenticated) {
      checkAuthenticationStatus();
    }
  }, [isAuthenticated, authLoading]);

  const checkAuthenticationStatus = async () => {
    try {
      // Check AsyncStorage for auth tokens
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      const isLoggedIn = await AsyncStorage.getItem('is_logged_in');

      devDebug('Manual auth check in Statistics:', {
        isAuthenticated,
        authLoading,
        hasRefreshToken: !!refreshToken,
        isLoggedIn: isLoggedIn === 'true',
      });

      // Only redirect to login if we truly don't have any auth tokens
      // If we have tokens but useRequireAuth says not authenticated,
      // it might be that SessionProvider is still loading, so we should wait
      if (!refreshToken && isLoggedIn !== 'true') {
        // No tokens found, redirect to login
        router.replace('/Login');
      }
      // If we have tokens but still not authenticated, SessionProvider should handle it
      // Don't redirect here as it might cause navigation issues
    } catch (error) {
      devDebug('Error checking auth status:', error);
    }
  };
};
export default useAuthCheck;
