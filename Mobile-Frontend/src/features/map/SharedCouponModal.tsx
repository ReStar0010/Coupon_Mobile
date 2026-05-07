import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

export interface SharedCoupon {
  store: string;
  amount: number;
  sharer: string;
  msg: string;
  label?: string;
}

interface SharedCouponModalProps {
  visible: boolean;
  coupon: SharedCoupon | null;
  onClaim: () => void;
  onClose: () => void;
}

export default function SharedCouponModal({
  visible, coupon, onClaim, onClose,
}: SharedCouponModalProps): React.JSX.Element {
  const [claimed, setClaimed] = useState(false);

  const handleClaim = () => {
    setClaimed(true);
    setTimeout(() => {
      setClaimed(false);
      onClaim();
    }, 1200);
  };

  const handleClose = () => {
    setClaimed(false);
    onClose();
  };

  if (!coupon) return <></>;

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {claimed ? (
          <View style={styles.successContainer}>
            <View style={styles.checkBox}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
            <Text style={styles.successTitle}>領取成功！</Text>
            <Text style={styles.successSub}>
              <Text style={styles.amount}>${coupon.amount}</Text> 優惠券已加入你的錢包
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.heading}>有人分享了一張券給你</Text>
            <View style={styles.couponCard}>
              <Text style={styles.storeName}>{coupon.store}</Text>
              <View style={styles.amountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <Text style={styles.amountNum}>{coupon.amount}</Text>
              </View>
              <Text style={styles.couponLabel}>現金折抵券</Text>
            </View>
            <View style={styles.messageCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>💬</Text>
              </View>
              <View style={styles.messageBody}>
                <Text style={styles.sharerName}>來自 {coupon.sharer}</Text>
                <Text style={styles.message}>「{coupon.msg}」</Text>
              </View>
            </View>
            <View style={styles.btnRow}>
              <Pressable onPress={handleClose} style={styles.skipBtn}>
                <Text style={styles.skipBtnText}>略過</Text>
              </Pressable>
              <Pressable onPress={handleClaim} style={styles.claimBtn}>
                <Text style={styles.claimBtnText}>確認領取 →</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: 3, borderBottomWidth: 0, borderColor: colors.border,
    padding: 20, paddingBottom: 32,
    shadowColor: colors.yellow, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 1, shadowRadius: 0,
  },
  handle: { width: 40, height: 5, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  heading: { fontFamily: fontFamilies.bold, fontSize: 17, color: colors.fg, marginBottom: 12 },
  couponCard: {
    backgroundColor: colors.yellow, borderWidth: 2.5, borderColor: colors.border,
    borderRadius: 8, padding: 16, marginBottom: 12,
    shadowColor: colors.border, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  storeName: {
    fontFamily: fontFamilies.monoRegular, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: 'rgba(51,51,51,0.6)', marginBottom: 6,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 4 },
  dollarSign: { fontFamily: fontFamilies.bold, fontSize: 22, color: colors.fg },
  amountNum: { fontFamily: fontFamilies.bold, fontSize: 52, color: colors.fg, letterSpacing: -2, lineHeight: 56 },
  couponLabel: { fontFamily: fontFamilies.semiBold, fontSize: 13, color: colors.fg },
  messageCard: {
    backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border,
    borderRadius: 6, padding: 10, paddingHorizontal: 12, marginBottom: 16,
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    shadowColor: colors.border, shadowOffset: { width: 1, height: 1 }, shadowOpacity: 1, shadowRadius: 0,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.fg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14 },
  messageBody: { flex: 1 },
  sharerName: { fontFamily: fontFamilies.regular, fontSize: 10, color: colors.muted, marginBottom: 3 },
  message: { fontFamily: fontFamilies.regular, fontSize: 13, color: colors.fg, lineHeight: 20 },
  btnRow: { flexDirection: 'row', gap: 10 },
  skipBtn: {
    flex: 1, padding: 13, backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.border, borderRadius: 6, alignItems: 'center',
    shadowColor: colors.border, shadowOffset: { width: 1, height: 1 }, shadowOpacity: 1, shadowRadius: 0,
  },
  skipBtnText: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.muted },
  claimBtn: {
    flex: 2, padding: 13, backgroundColor: colors.yellow,
    borderWidth: 2.5, borderColor: colors.border, borderRadius: 6, alignItems: 'center',
    shadowColor: colors.border, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  claimBtnText: { fontFamily: fontFamilies.bold, fontSize: 15, color: colors.fg },
  successContainer: { alignItems: 'center', paddingVertical: 16 },
  checkBox: {
    width: 60, height: 60, borderRadius: 6, backgroundColor: colors.yellow,
    borderWidth: 2.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.border, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  checkMark: { fontSize: 28, color: colors.fg },
  successTitle: { fontFamily: fontFamilies.bold, fontSize: 20, color: colors.fg, marginBottom: 6 },
  successSub: { fontFamily: fontFamilies.monoRegular, fontSize: 13, color: colors.muted },
  amount: { color: colors.fg, fontFamily: fontFamilies.bold },
});
