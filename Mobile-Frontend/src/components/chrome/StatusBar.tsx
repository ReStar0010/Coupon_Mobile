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
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
