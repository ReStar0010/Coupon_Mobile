import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>兌換現金券</Text>
        <Text style={styles.subtitle}>
          餘額 <Text style={styles.bold}>{couPoints} pt</Text> · 選擇面額
        </Text>
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
                <Text style={[styles.voucherCost, !canAfford && styles.textMuted]}>
                  {voucher.cost}pt
                </Text>
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
            <Text style={[styles.confirmText, !ok && styles.confirmTextDisabled]}>
              {ok && v ? `兌換 $${v.amt} 現金券 (−${v.cost} pt)` : '選擇面額'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 16,
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
  voucherCost: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
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
  confirmText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: colors.yellow,
  },
  confirmTextDisabled: {
    color: '#aaa',
  },
});
