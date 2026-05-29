import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';

interface PermissionDeniedViewProps {
  /** Title text. e.g. "需要相機權限" */
  title: string;
  /** Optional secondary explanation shown beneath the title. */
  description?: string;
  /**
   * If the OS will still show its own prompt (granted is null/undefined or
   * canAskAgain is true), pass an `onRetry` to re-trigger it. Otherwise omit
   * `onRetry` and the user gets only the "Open Settings" button — the OS
   * permanent-deny case.
   */
  onRetry?: () => void;
  /** Override CTA label for the Settings button. */
  settingsLabel?: string;
  /** Override CTA label for the retry button. */
  retryLabel?: string;
}

/**
 * Shared empty-state for missing OS permissions (camera, location, etc.).
 *
 * iOS only shows its native permission dialog once; after the user denies,
 * `requestPermission()` resolves immediately with the cached deny and the
 * UI looks frozen. Showing an "Open Settings" CTA gives the user a way out
 * without uninstalling the app.
 */
export default function PermissionDeniedView({
  title,
  description,
  onRetry,
  settingsLabel = '前往設定開啟權限',
  retryLabel = '再次允許',
}: PermissionDeniedViewProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.actions}>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [styles.btn, styles.btnRetry, pressed && styles.btnPressed]}
            accessibilityRole="button"
            testID="permission-retry"
          >
            <Text style={styles.btnText}>{retryLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          // Linking.openSettings() is the cross-platform deep-link to this
          // app's settings page; safe to call even when permissions were
          // never asked.
          onPress={() => {
            void Linking.openSettings();
          }}
          style={({ pressed }) => [styles.btn, styles.btnSettings, pressed && styles.btnPressed]}
          accessibilityRole="button"
          testID="permission-open-settings"
        >
          <Text style={styles.btnText}>{settingsLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  description: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    maxWidth: 280,
  },
  actions: {
    marginTop: 8,
    gap: 8,
    alignItems: 'stretch',
    minWidth: 220,
  },
  btn: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnSettings: {
    backgroundColor: colors.yellow,
  },
  btnRetry: {
    backgroundColor: colors.card,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: colors.fg,
  },
});
