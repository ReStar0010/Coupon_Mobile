import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

interface CouPointsCardProps {
  couPoints: number;
  onRedeem: () => void;
}

const REDEEM_THRESHOLD = 130;
const REDEEM_VALUE = 25;

export default function CouPointsCard({
  couPoints,
  onRedeem,
}: CouPointsCardProps): React.JSX.Element {
  const progress = Math.min(100, Math.round((couPoints / REDEEM_THRESHOLD) * 100));
  const remaining = Math.max(0, REDEEM_THRESHOLD - couPoints);

  return (
    <View style={styles.wrapper}>
      <View style={styles.shadow} />
      <View style={styles.card}>
        <View style={styles.top}>
          <View>
            <Text style={styles.label}>CouPoint 餘額</Text>
            <View style={styles.balanceRow}>
              <Text
                testID="coupoints-balance"
                style={styles.balanceNum}
              >
                {couPoints}
              </Text>
              <Text style={styles.balanceUnit}>pt</Text>
            </View>
            {remaining > 0 && (
              <Text style={styles.hint}>再 {remaining} pt 即可兌換 ${REDEEM_VALUE} 折抵券</Text>
            )}
          </View>
          <View style={styles.redeemBtnWrapper}>
            <Pressable onPress={onRedeem} style={styles.redeemBtn}>
              <Text style={styles.redeemBtnText}>兌換 →</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` as `${number}%` }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>0 pt</Text>
          <Text style={styles.progressLabel}>${REDEEM_VALUE} →</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  shadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 18,
    paddingBottom: 16,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  label: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(51,51,51,0.65)',
    marginBottom: 5,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  balanceNum: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 58,
    lineHeight: 58,
    letterSpacing: -2.32,
    color: colors.fg,
  },
  balanceUnit: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    color: 'rgba(51,51,51,0.65)',
    marginBottom: 4,
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.fg,
    marginTop: 3,
  },
  redeemBtnWrapper: {
    marginTop: 8,
  },
  redeemBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: colors.fg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
  },
  redeemBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    letterSpacing: -0.14,
    color: colors.yellow,
  },
  progressTrack: {
    height: 10,
    backgroundColor: 'rgba(51,51,51,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(51,51,51,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.fg,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  progressLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    color: 'rgba(51,51,51,0.55)',
  },
});
