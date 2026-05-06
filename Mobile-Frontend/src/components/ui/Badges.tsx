import React from 'react';
import { View, StyleSheet } from 'react-native';
import AnimNum from './AnimNum';
import GemIcon from '../icons/GemIcon';
import CoinIcon from '../icons/CoinIcon';
import { colors } from '../../theme/colors';

interface GemBadgeProps {
  count: number;
}

interface CouPointBadgeProps {
  count: number;
}

export function GemBadge({ count }: GemBadgeProps): React.JSX.Element {
  return (
    <View style={styles.gemBadge}>
      <GemIcon size={14} color={colors.purpleLight} />
      <AnimNum value={count} color={colors.purpleLight} fontSize={13} />
    </View>
  );
}

export function CouPointBadge({ count }: CouPointBadgeProps): React.JSX.Element {
  return (
    <View style={styles.couPointBadge}>
      <CoinIcon size={14} />
      <AnimNum value={count} color={colors.fg} fontSize={13} />
    </View>
  );
}

const styles = StyleSheet.create({
  gemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.canvas,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  couPointBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.yellowLight,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
});
