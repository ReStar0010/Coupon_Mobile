import { useEffect } from 'react';
// import * as Sentry from '@sentry/react-native';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/constants/colors';
import { useAuth } from './components/providers/AuthProvider';
import { initStorage } from '@/utils/api';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Wait for auth check to complete
    if (isLoading) return;

    // Double-check with refresh token before redirecting
    // This prevents redirecting when access token is expired but refresh token exists
    const checkTokens = async () => {
      try {
        await initStorage();
        // Read directly from AsyncStorage for most reliable check
        const refreshToken = await AsyncStorage.getItem('merchant_refresh_token');

        console.log('[Index] Token check:', {
          isAuthenticated,
          hasRefreshToken: !!refreshToken,
        });

        // If we have a refresh token, user is authenticated (even if access token expired)
        if (refreshToken) {
          console.log('[Index] Refresh token found, user is authenticated');
          // Let AuthProvider handle redirecting to appropriate page
          return;
        }

        // Only redirect to login if truly not authenticated
        if (!isAuthenticated && !refreshToken) {
          console.log('[Index] No tokens found, redirecting to login');
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('[Index] Error checking tokens:', error);
        // Sentry.captureException(error, { data: { context: 'merchant.index.checkTokens' } });
        // Only redirect if we're sure there are no tokens
        if (!isAuthenticated) {
          router.replace('/(auth)/login');
        }
      }
    };

    // Use setTimeout to ensure router is mounted
    const timer = setTimeout(() => {
      checkTokens();
    }, 100); // Small delay to ensure storage is initialized

    return () => clearTimeout(timer);
  }, [router, isAuthenticated, isLoading]);

  // Show loading indicator while redirecting or checking auth
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.white,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
