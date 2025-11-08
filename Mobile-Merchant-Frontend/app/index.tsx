import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/constants/colors';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Use setTimeout to ensure router is mounted
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 0);

    return () => clearTimeout(timer);
  }, [router]);

  // Show loading indicator while redirecting
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

