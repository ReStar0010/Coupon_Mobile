import React from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import { colors } from '../theme/colors';
import { fontFamilies } from '../theme/typography';
import { spacing } from '../theme/spacing';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level render-error catch.
 *
 * Sentry's `Sentry.wrap()` reports crashes but does NOT render a
 * fallback — a single render throw in the tree below otherwise shows
 * a blank screen on iOS and a red screen of death in dev. This
 * boundary catches anything below it and:
 *
 *   1. Reports the actual error to Sentry (with full stack).
 *   2. Renders a neo-brutalism fallback card. The card NEVER shows
 *      the raw error message — that's a defence-in-depth measure so
 *      a stack frame that mentions a token / id / user-id doesn't
 *      leak to the screen.
 *   3. Offers a "重新載入" button that calls expo-updates
 *      `reloadAsync()` to restart the JS bundle without uninstalling
 *      the app — typically resolves transient state corruption.
 *
 * Why a class component: `componentDidCatch` and `getDerivedStateFromError`
 * are class-only React APIs. There is no hook equivalent.
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Capture the real error with the component stack so triage is
    // possible from Sentry alone — the on-screen fallback intentionally
    // does NOT show the message.
    try {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: errorInfo.componentStack ?? '' } },
      } as Parameters<typeof Sentry.captureException>[1]);
    } catch {
      // Swallow — telemetry must never crash the fallback path.
    }
  }

  private handleReload = (): void => {
    void Updates.reloadAsync().catch(() => {
      // If reload fails (Expo Go, no JS bundle), reset local state so
      // the user at least gets the children re-mounted optimistically.
      this.setState({ hasError: false });
    });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <SafeAreaView style={styles.root}>
        <View testID="error-boundary-fallback" style={styles.card}>
          <View style={styles.cardShadow} />
          <View style={styles.cardBody}>
            <Text style={styles.title}>哎呀，出了點問題</Text>
            <Text style={styles.body}>
              我們已經記錄這個錯誤，請點下方按鈕重新載入 CouPro。
            </Text>
            <Pressable
              testID="error-boundary-reload"
              onPress={this.handleReload}
              style={styles.cta}
              accessibilityRole="button"
              accessibilityLabel="重新載入"
            >
              <Text style={styles.ctaText}>重新載入</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    position: 'relative',
  },
  cardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  cardBody: {
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: colors.fg,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  cta: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    color: colors.fg,
  },
});
