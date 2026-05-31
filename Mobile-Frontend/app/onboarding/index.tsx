import React from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import LaunchOnboardingScreen from '@/src/features/onboarding/LaunchOnboardingScreen';

/**
 * Launch-intro route. Two entry paths:
 *   1. First launch — app/index.tsx mounts this when the user is
 *      unauthenticated AND hasn't seen the intro. On completion → login.
 *   2. Replay — a logged-in user taps "重看新手教學" in Settings (which
 *      resets the onboarding flags and pushes here). On completion → home.
 *
 * So `onDone` routes by auth state: authenticated → tabs/home, otherwise
 * → login.
 */
export default function OnboardingRoute(): React.JSX.Element {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  return (
    <LaunchOnboardingScreen
      onDone={() =>
        router.replace(isAuthenticated ? '/(tabs)/home' : '/(auth)/login')
      }
    />
  );
}
