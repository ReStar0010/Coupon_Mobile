import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import CoinIcon from '@/src/components/icons/CoinIcon';
import BottomSheet from '@/src/components/ui/BottomSheet';

interface Voucher {
  amt: number;
  cost: number;
}

const VOUCHERS: Voucher[] = [
  { amt: 25, cost: 100 },
  { amt: 50, cost: 180 },
  { amt: 100, cost: 320 },
  { amt: 150, cost: 450 },
  { amt: 200, cost: 580 },
];

interface RedeemModalProps {
  visible: boolean;
  couPoints: number;
  onClose: () => void;
  onRedeem: (voucher: Voucher) => void;
}

export default function RedeemModal({
  visible,
  couPoints,
  onClose,
  onRedeem,
}: RedeemModalProps): React.JSX.Element {
  const [sel, setSel] = useState<number | null>(null);
  const v = sel !== null ? VOUCHERS[sel] : null;
  const ok = v !== null && couPoints >= v.cost;

  const handleConfirm = () => {
    if (ok && v) {
      onRedeem(v);
      onClose();
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>兌換現金折抵</Text>

        {/* Balance subtitle */}
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>餘額 </Text>
          <CoinIcon size={13} />
          <Text style={[styles.subtitle, styles.bold]}> {couPoints}</Text>
          <Text style={styles.subtitle}> · 選擇面額</Text>
        </View>

        <View style={styles.grid}>
          {VOUCHERS.map((voucher, i) => {
            const canAfford = couPoints >= voucher.cost;
            const active = sel === i;
            return (
              <Pressable
                key={i}
                onPress={() => canAfford && setSel(i)}
                style={[
                  styles.voucherCell,
                  active && styles.voucherCellActive,
                  !canAfford && styles.voucherCellDisabled,
                  canAfford && !active && styles.voucherCellAffordable,
                ]}
              >
                <Text style={[styles.voucherAmt, !canAfford && styles.textMuted]}>
                  ${voucher.amt}
                </Text>
                <View style={styles.voucherCostRow}>
                  <CoinIcon size={10} />
                  <Text style={[styles.voucherCost, !canAfford && styles.textMuted]}>
                    {' '}
                    {voucher.cost}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.confirmWrapper}>
          {ok && <View style={styles.confirmShadow} />}
          <Pressable
            disabled={!ok}
            onPress={handleConfirm}
            style={[styles.confirmBtn, !ok && styles.confirmBtnDisabled]}
          >
            {ok && v ? (
              <View style={styles.confirmInner}>
                <Text style={styles.confirmText}>兌換 ${v.amt} 現金折抵 (−</Text>
                <CoinIcon size={14} />
                <Text style={styles.confirmText}>{v.cost})</Text>
              </View>
            ) : (
              <Text style={[styles.confirmText, styles.confirmTextDisabled]}>選擇面額</Text>
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: colors.border,
    padding: 20,
    paddingBottom: 32,
    shadowColor: colors.yellow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    letterSpacing: -0.36,
    color: colors.fg,
    marginBottom: 4,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
  },
  bold: {
    fontFamily: fontFamilies.bold,
    color: colors.fg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  voucherCell: {
    width: '18%',
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: colors.subtle,
    paddingVertical: 10,
    alignItems: 'center',
  },
  voucherCellAffordable: {
    borderColor: colors.yellow,
    backgroundColor: colors.yellowLight,
  },
  voucherCellActive: {
    borderColor: colors.fg,
    backgroundColor: colors.yellow,
  },
  voucherCellDisabled: {
    opacity: 0.45,
    backgroundColor: '#f5f5f5',
  },
  voucherAmt: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: colors.fg,
  },
  voucherCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  voucherCost: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 9,
    color: colors.muted,
  },
  textMuted: {
    color: colors.muted,
  },
  confirmWrapper: {
    position: 'relative',
  },
  confirmShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.fg,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#ccc',
    borderColor: colors.subtle,
  },
  confirmInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: colors.yellow,
  },
  confirmTextDisabled: {
    color: '#aaa',
  },
});
