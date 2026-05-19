import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import CoinIcon from '@/src/components/icons/CoinIcon';

interface CouPointsCardProps {
  couPoints: number;
  onUse: () => void;
  onHistory?: () => void;
}

const VOUCHER_TIERS = [
  { amt: 5, cost: 26 },
  { amt: 10, cost: 52 },
  { amt: 15, cost: 78 },
  { amt: 20, cost: 104 },
  { amt: 25, cost: 130 },
];

export default function CouPointsCard({
  couPoints,
  onUse,
  onHistory,
}: CouPointsCardProps): React.JSX.Element {
  const nextTier =
    VOUCHER_TIERS.find((t) => t.cost > couPoints) ?? VOUCHER_TIERS[VOUCHER_TIERS.length - 1];
  const progress = Math.min(100, Math.round((couPoints / nextTier.cost) * 100));
  const remaining = Math.max(0, nextTier.cost - couPoints);

  return (
    <View style={styles.wrapper}>
      <View style={styles.shadow} />
      <View style={styles.card}>
        <Text style={styles.label}>CouPoint 餘額</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceIconWrap}>
            <CoinIcon size={40} />
          </View>
          <Text testID="coupoints-balance" style={styles.balanceNum}>
            {couPoints}
          </Text>
        </View>
        {remaining > 0 && (
          <Text style={styles.hint}>
            再 {remaining} 點可兌換 ${nextTier.amt} 級距
          </Text>
        )}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` as `${number}%` }]} />
        </View>
        <View style={styles.btnRow}>
          <Pressable onPress={onUse} style={styles.redeemBtn}>
            <Text style={styles.redeemBtnText}>掃碼使用</Text>
          </Pressable>
          <Pressable onPress={onHistory} style={styles.historyBtn}>
            <Text style={styles.historyBtnText}>歷史紀錄</Text>
          </Pressable>
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
    backgroundColor: '#18181C',
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  label: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 5,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  balanceIconWrap: {
    width: 40,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceNum: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 58,
    lineHeight: 58,
    letterSpacing: -2.32,
    color: '#fff',
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.yellow,
    borderRadius: 3,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  redeemBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.yellow,
    borderRadius: 6,
    alignItems: 'center',
  },
  redeemBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    letterSpacing: -0.13,
    color: colors.fg,
  },
  historyBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    alignItems: 'center',
  },
  historyBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
});
