import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { hasSeenLaunchOnboarding } from '@/src/services/onboarding/onboardingState';

/**
 * Root gate. Three terminal states:
 *
 *   - Auth restored → /(tabs)/home
 *   - Unauthenticated AND launch intro unseen → /onboarding
 *   - Unauthenticated AND launch intro seen → /(auth)/login
 *
 * We resolve the AsyncStorage check in parallel with the auth bootstrap
 * so the user sees one spinner, not two. Failing the check defaults to
 * "seen" (skip the intro) so a storage outage never traps a returning
 * user on a re-shown tutorial.
 */
export default function Index(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasSeenLaunchOnboarding()
      .then((seen) => {
        if (!cancelled) setOnboardingSeen(seen);
      })
      .catch(() => {
        // Treat read failure as "seen" — over-showing the intro to
        // returning users is a worse failure than under-showing.
        if (!cancelled) setOnboardingSeen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    );
  }

  // Authenticated users bypass the onboarding-flag read entirely — they
  // never see the launch intro again. Short-circuiting here keeps the
  // returning-user redirect snappy if AsyncStorage is slow.
  if (isAuthenticated) return <Redirect href="/(tabs)/home" />;

  // Unauthenticated path: need to know whether the user has seen the
  // intro before we can choose login vs. onboarding.
  if (onboardingSeen === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    );
  }
  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
