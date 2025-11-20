import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/constants/colors';
import { useAuth } from './components/providers/AuthProvider';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Wait for auth check to complete
    if (isLoading) return;

    // Use setTimeout to ensure router is mounted
    const timer = setTimeout(() => {
      // Only redirect to login if not authenticated
      // If authenticated, let AuthProvider handle the redirect
      if (!isAuthenticated) {
      router.replace('/(auth)/login');
      }
      // If authenticated, AuthProvider will handle redirecting to appropriate page
    }, 0);

    return () => clearTimeout(timer);
  }, [router, isAuthenticated, isLoading]);

  // Show loading indicator while redirecting or checking auth
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

