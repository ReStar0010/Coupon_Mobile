import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { GemBadge, CouPointBadge } from '../ui/Badges';

interface StatusBarProps {
  gems?: number;
  couPoints?: number;
  light?: boolean;
}

export default function StatusBar({
  gems = 0,
  couPoints = 0,
  light = false,
}: StatusBarProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={[styles.time, light && styles.timeLight]}>9:41</Text>
      <View style={styles.badges}>
        <CouPointBadge count={couPoints} />
        <GemBadge count={gems} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 26,
    paddingBottom: 8,
    flexShrink: 0,
    zIndex: 10,
    position: 'relative',
  },
  time: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.fg,
  },
  timeLight: {
    color: 'rgba(255,255,255,0.85)',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
