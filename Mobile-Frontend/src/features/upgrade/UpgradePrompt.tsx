import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Modal } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { getVersionInfo, type AppVersionInfo } from '@/src/services/api/appVersion';
import { compareVersions } from './semverCompare';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { spacing } from '@/src/theme/spacing';

/**
 * Resolve the running app's version string.
 *
 * On iOS/Android, `Application.nativeApplicationVersion` reads from the
 * native bundle (CFBundleShortVersionString / versionName) — that's
 * the canonical source on a real device.
 *
 * On web — including Playwright E2E and the Expo Web preview —
 * `nativeApplicationVersion` is `null` because there is no native
 * bundle. Falling back to `Constants.expoConfig?.version` (the value
 * baked into `app.json`) gives the upgrade prompt something to compare
 * against in the web build instead of bailing to `'up-to-date'` and
 * never firing the API call.
 */
function resolveCurrentVersion(): string | null {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null;
}

type Mode = 'idle' | 'up-to-date' | 'recommend' | 'force';

// CRITICAL: the storeUrl comes from a BE response, and Linking.openURL
// will happily launch `javascript:`, `intent://`, or any phishing URL.
// If the BE settings layer is ever compromised — env var mis-set,
// MITM on an unverified TLS link, or a supply-chain incident — an
// attacker could weaponise the upgrade button. Allowlist the two
// legitimate stores by origin so an attacker can't redirect users.
const ALLOWED_STORE_ORIGINS: readonly string[] = [
  'https://apps.apple.com',
  'https://play.google.com',
];

function isAllowedStoreUrl(raw: string): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return ALLOWED_STORE_ORIGINS.includes(parsed.origin);
  } catch {
    return false;
  }
}

/**
 * Floats above the entire app and decides whether to show:
 *
 *   - Force-update modal — blocking primary action with a discreet
 *     "離線中？稍後再試" secondary link that hides the modal for the
 *     current session only. Current native version is below the BE's
 *     `minVersion`.
 *
 *   - Recommend banner — current version is between min and latest.
 *     v1 re-shows on every cold start; per-latestVersion dismissal
 *     persistence is a tracked follow-up (TODO: add an AsyncStorage
 *     key `upgrade_dismissed_v{latestVersion}` once we have telemetry
 *     showing the banner is bothering users).
 *
 *   - Nothing — current >= latest, version-info request failed
 *     (fail-open so a broken endpoint never traps users), or
 *     `nativeApplicationVersion` is unknown.
 */
export default function UpgradePrompt(): React.JSX.Element | null {
  const [mode, setMode] = useState<Mode>('idle');
  const [storeUrl, setStoreUrl] = useState<string>('');
  const [latestVersion, setLatestVersion] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = resolveCurrentVersion();
      if (!current) {
        if (!cancelled) setMode('up-to-date');
        return;
      }
      let info: AppVersionInfo;
      try {
        info = await getVersionInfo();
      } catch {
        // Fail-open: a broken endpoint must not block the user.
        if (!cancelled) setMode('up-to-date');
        return;
      }
      if (cancelled) return;
      setStoreUrl(info.storeUrl);
      setLatestVersion(info.latestVersion);
      if (compareVersions(current, info.minVersion) < 0) {
        setMode('force');
      } else if (compareVersions(current, info.latestVersion) < 0) {
        setMode('recommend');
      } else {
        setMode('up-to-date');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === 'idle' || mode === 'up-to-date') return null;

  const openStore = (): void => {
    if (!isAllowedStoreUrl(storeUrl)) return;
    void Linking.openURL(storeUrl);
  };

  if (mode === 'force') {
    return (
      <Modal visible transparent animationType="fade" testID="upgrade-force-modal">
        <View style={styles.modalBackdrop}>
          <View style={styles.forceCard}>
            <Text style={styles.forceTitle}>需要更新 CouPro</Text>
            <Text style={styles.forceBody}>
              你目前使用的版本太舊，無法繼續使用。請至商店更新到最新版本。
            </Text>
            <Pressable
              testID="upgrade-force-btn"
              onPress={openStore}
              style={styles.primaryBtn}
              accessibilityRole="button"
              accessibilityLabel="前往商店更新"
            >
              <Text style={styles.primaryBtnText}>前往更新</Text>
            </Pressable>
            {/* Offline escape hatch — without it, an offline user is
                soft-locked staring at the modal with no way out. This
                only hides the modal for the CURRENT session; the next
                cold start re-checks the version and re-shows it. We
                intentionally keep the link discreet so it's not a
                first-class dismiss button — the goal is still to drive
                upgrades, just not to brick the app for offline users. */}
            <Pressable
              testID="upgrade-force-defer-btn"
              onPress={() => setMode('idle')}
              style={styles.deferLink}
              accessibilityRole="button"
              accessibilityLabel="離線稍後再試"
              hitSlop={8}
            >
              <Text style={styles.deferLinkText}>離線中？稍後再試</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // Recommend banner.
  return (
    <View testID="upgrade-recommend-banner" style={styles.banner}>
      <View style={styles.bannerTextWrap}>
        <Text style={styles.bannerTitle}>有新版本可用</Text>
        <Text style={styles.bannerBody}>升級到 v{latestVersion} 取得最新功能與修正。</Text>
      </View>
      <Pressable
        testID="upgrade-recommend-btn"
        onPress={openStore}
        style={styles.bannerBtn}
        accessibilityRole="button"
        accessibilityLabel={`更新到 v${latestVersion}`}
      >
        <Text style={styles.bannerBtnText}>更新</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  forceCard: {
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
    shadowColor: colors.yellow,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  forceTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    color: colors.fg,
    marginBottom: spacing.sm,
  },
  forceBody: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    color: colors.fg,
  },
  deferLink: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  deferLinkText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  banner: {
    position: 'absolute',
    bottom: 96, // sit above the tab bar
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.fg,
    borderWidth: 2.5,
    borderColor: colors.yellow,
    borderRadius: 10,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: colors.yellow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    zIndex: 100,
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    color: '#fff',
  },
  bannerBody: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
  },
  bannerBtn: {
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    color: colors.fg,
  },
});
