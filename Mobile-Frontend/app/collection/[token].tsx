import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { spacing } from '@/src/theme/spacing';
import { useAuth } from '@/src/state/AuthContext';
import { acceptShare } from '@/src/services/api/sharing';
import { track } from '@/src/services/analytics/posthog';

/**
 * Deep-link landing for shared coupons.
 *
 * Two entry routes — both resolved by Expo Router to this file:
 *   - Custom scheme : `coupro://collection?token=…` (in-app + share-sheet)
 *   - Universal Link: `https://api.coupro.pro/collection/<token>/?open_ext=1`
 *
 * Either way we read the token and POST to the BE's
 * accept_share_request endpoint. The BE owns the race / self-claim /
 * already-claimed checks; we just project its response into a single
 * focused success/error screen.
 *
 * Auth gating: an unauthenticated user can't accept (BE returns 401),
 * so we bounce them to /(auth)/login first. We don't currently round-trip
 * the token through login — once logged in the user reopens the link
 * from their messaging app. A future enhancement would persist the token
 * across the auth flow.
 */
type ClaimState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; couponName: string }
  | { kind: 'error'; message: string };

export default function CollectionTokenRoute(): React.JSX.Element {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<ClaimState>({ kind: 'idle' });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      // Send the user to login. After login they can reopen the link.
      router.replace('/(auth)/login');
      return;
    }
    if (!token) {
      setState({ kind: 'error', message: '連結無效或已過期。' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    track('coupon.claim_started', { source: 'deep_link' });
    acceptShare(token)
      .then((res) => {
        if (cancelled) return;
        track('coupon.claim_succeeded', { couponId: res.coupon_id });
        setState({ kind: 'success', couponName: res.coupon_name || '優惠券' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error && err.message ? err.message : '領取失敗，請稍後再試。';
        track('coupon.claim_failed', { reason: message.slice(0, 80) });
        setState({ kind: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated, authLoading, router]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.body}>
        {(state.kind === 'idle' || state.kind === 'loading') && (
          <>
            <ActivityIndicator size="large" color={colors.purple} />
            <Text style={s.title}>正在領取你的優惠券…</Text>
          </>
        )}
        {state.kind === 'success' && (
          <>
            <Text style={s.bigCheck}>✓</Text>
            <Text style={s.title}>已領取！</Text>
            <Text style={s.sub}>{state.couponName}</Text>
            <Pressable
              testID="claim-go-home"
              onPress={() => router.replace('/(tabs)/home')}
              style={s.cta}
              accessibilityRole="button"
            >
              <Text style={s.ctaText}>看我的優惠券</Text>
            </Pressable>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <Text style={s.title}>領取失敗</Text>
            <Text testID="claim-error" style={s.errorText}>{state.message}</Text>
            <Pressable
              testID="claim-go-home"
              onPress={() => router.replace('/(tabs)/home')}
              style={s.cta}
              accessibilityRole="button"
            >
              <Text style={s.ctaText}>回首頁</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  bigCheck: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 56,
    color: colors.purple,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: colors.fg,
    marginTop: 8,
  },
  sub: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: colors.muted,
  },
  errorText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: colors.red,
    textAlign: 'center',
  },
  cta: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.purple,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  ctaText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    color: '#fff',
  },
});
