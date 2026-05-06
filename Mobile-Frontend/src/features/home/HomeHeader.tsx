import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import LogoIcon from '@/src/components/icons/LogoIcon';
import SettingsIcon from '@/src/components/icons/SettingsIcon';
import { GemBadge, CouPointBadge } from '@/src/components/ui/Badges';

interface HomeHeaderProps {
  gems: number;
  couPoints: number;
  onSettings: () => void;
}

export default function HomeHeader({
  gems,
  couPoints,
  onSettings,
}: HomeHeaderProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <View style={styles.logoWrapper}>
          <View style={styles.logoShadow} />
          <View style={styles.logoBox}>
            <LogoIcon size={26} />
          </View>
        </View>
        <Text style={styles.title}>CouPro</Text>
      </View>
      <View style={styles.actions}>
        <CouPointBadge count={couPoints} />
        <GemBadge count={gems} />
        <View style={styles.settingsBtnWrapper}>
          <View style={styles.settingsBtnShadow} />
          <Pressable
            testID="settings-btn"
            onPress={onSettings}
            style={styles.settingsBtn}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <SettingsIcon size={16} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 2,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoWrapper: {
    position: 'relative',
    width: 38,
    height: 38,
  },
  logoShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  logoBox: {
    width: 38,
    height: 38,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    letterSpacing: -0.77,
    color: colors.fg,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsBtnWrapper: {
    position: 'relative',
    width: 34,
    height: 34,
  },
  settingsBtnShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  settingsBtn: {
    width: 34,
    height: 34,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
