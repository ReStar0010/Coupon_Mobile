import React from 'react';
import { useRouter } from 'expo-router';
import LaunchOnboardingScreen from '@/src/features/onboarding/LaunchOnboardingScreen';

/**
 * First-launch onboarding route. Mounted by app/index.tsx when the user
 * is unauthenticated AND has not yet seen the launch intro.
 *
 * On completion (skip or final-page tap) the screen writes the
 * "seen" flag via the onboarding-state service, then we route to
 * /(auth)/login. Returning users with a stored token go straight to
 * the tabs via app/index.tsx — they never enter this route.
 */
export default function OnboardingRoute(): React.JSX.Element {
  const router = useRouter();
  return <LaunchOnboardingScreen onDone={() => router.replace('/(auth)/login')} />;
}
