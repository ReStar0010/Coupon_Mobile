import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import GemIcon from '@/src/components/icons/GemIcon';
import { acceptShare } from '@/src/services/api/sharing';
import { useWallet } from '@/src/state/WalletContext';

export interface SharedCoupon {
  token: string;
  store: string;
  /** estimated savings — rendered as a small 可省 $ badge, not a money hero. */
  amount: number;
  sharer: string;
  msg: string;
  /** coupon_name — the ticket title. */
  label?: string;
  /** coupon_detail — secondary line under the title. */
  detail?: string;
  /** 'exclusive' | 'store' — drives the 專屬優惠 / 隨取即用 label. */
  type?: string;
  /** Pre-formatted expiry (e.g. '2026/06/30') for the 到期日 row. */
  expires?: string;
  /** Gems the sharer earns when this coupon is used — shown as 分享獎勵. */
  gem_reward?: number;
}

interface SharedCouponModalProps {
  visible: boolean;
  coupon: SharedCoupon | null;
  onClaim: () => void;
  onClose: () => void;
}

/**
 * CouMap "collect a shared coupon" bottom sheet: shows the coupon info ticket
 * (store, name, detail, savings, type, expiry, share-reward gem) and lets the
 * recipient accept it into their wallet.
 */
export default function SharedCouponModal({
  visible, coupon, onClaim, onClose,
}: SharedCouponModalProps): React.JSX.Element {
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { refreshWallet } = useWallet();

  const handleClaim = async () => {
    if (!coupon || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      await acceptShare(coupon.token);
      // The claim transferred the coupon to this user on the server. Pull the
      // canonical wallet so the new coupon shows up on the Home tab — which
      // otherwise stays mounted and never re-fetches on tab switch. Mirrors
      // DrawModal: fire-and-forget while the success animation plays.
      void refreshWallet().catch(() => undefined);
      setClaimed(true);
      claimTimerRef.current = setTimeout(() => {
        claimTimerRef.current = null;
        setClaimed(false);
        setClaiming(false);
        onClaim();
      }, 1200);
    } catch (err: unknown) {
      setClaiming(false);
      const msg = err instanceof Error ? err.message : '領取失敗，請稍後再試';
      setError(msg);
    }
  };

  const handleClose = () => {
    if (claimTimerRef.current) {
      clearTimeout(claimTimerRef.current);
      claimTimerRef.current = null;
    }
    setClaimed(false);
    setClaiming(false);
    setError(null);
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
              「{coupon.label ?? '優惠券'}」已加入你的錢包
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.heading}>有人分享了一張券給你</Text>
            <View style={styles.couponCard}>
              <Text style={styles.storeName}>{coupon.store}</Text>
              <Text style={styles.couponName} numberOfLines={2}>
                {coupon.label ?? '優惠券'}
              </Text>
              {coupon.detail ? (
                <Text style={styles.couponDetail} numberOfLines={2}>
                  {coupon.detail}
                </Text>
              ) : null}
              {coupon.amount > 0 ? (
                <Text style={styles.savingsHint}>可省 ${coupon.amount}</Text>
              ) : null}
              <Text style={styles.typeLabel}>
                {coupon.type === 'store' ? '隨取即用' : '專屬優惠'}
              </Text>
              <View style={styles.tearLine}>
                <View style={styles.tearCircleLeft} />
                <View style={styles.dashed} />
                <View style={styles.tearCircleRight} />
              </View>
              <View style={styles.metaGrid}>
                <View>
                  <Text style={styles.metaKey}>到期日</Text>
                  <Text style={styles.metaVal}>{coupon.expires ?? '—'}</Text>
                </View>
                <View>
                  <Text style={styles.metaKey}>分享獎勵</Text>
                  <View style={styles.gemRow}>
                    {Array.from({ length: Math.min(coupon.gem_reward ?? 1, 5) }).map((_, i) => (
                      <GemIcon key={i} size={18} color={colors.purpleLight} />
                    ))}
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.messageCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>💬</Text>
              </View>
              <View style={styles.messageBody}>
                <Text style={styles.sharerName}>來自 {coupon.sharer}</Text>
                {coupon.msg ? (
                  <Text style={styles.message}>「{coupon.msg}」</Text>
                ) : null}
              </View>
            </View>
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            <View style={styles.btnRow}>
              <Pressable onPress={handleClose} style={styles.skipBtn}>
                <Text style={styles.skipBtnText}>略過</Text>
              </Pressable>
              <Pressable
                onPress={handleClaim}
                style={[styles.claimBtn, claiming && styles.claimBtnDisabled]}
                disabled={claiming}
              >
                <Text style={styles.claimBtnText}>
                  {claiming ? '領取中…' : '確認領取 →'}
                </Text>
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
  couponName: {
    fontFamily: fontFamilies.extraBold, fontSize: 24, letterSpacing: -0.6,
    lineHeight: 30, color: colors.fg, marginBottom: 4,
  },
  couponDetail: {
    fontFamily: fontFamilies.regular, fontSize: 14, color: colors.fg, marginBottom: 8,
  },
  savingsHint: {
    alignSelf: 'flex-start',
    fontFamily: fontFamilies.bold, fontSize: 13, color: colors.fg,
    backgroundColor: 'rgba(51,51,51,0.12)', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8,
    overflow: 'hidden',
  },
  typeLabel: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg },
  tearLine: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  tearCircleLeft: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: colors.bg,
    borderWidth: 2, borderColor: colors.border, marginLeft: -24,
  },
  tearCircleRight: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: colors.bg,
    borderWidth: 2, borderColor: colors.border, marginRight: -24,
  },
  dashed: {
    flex: 1, borderBottomWidth: 2, borderColor: colors.border,
    borderStyle: 'dashed', marginHorizontal: 8,
  },
  metaGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  metaKey: {
    fontFamily: fontFamilies.monoRegular, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: 'rgba(51,51,51,0.6)', marginBottom: 4,
  },
  metaVal: { fontFamily: fontFamilies.bold, fontSize: 16, color: colors.fg },
  gemRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
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
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnText: { fontFamily: fontFamilies.bold, fontSize: 15, color: colors.fg },
  errorText: { fontFamily: fontFamilies.regular, fontSize: 12, color: '#D32F2F', marginBottom: 10 },
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
});
