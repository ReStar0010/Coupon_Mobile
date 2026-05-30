import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import GemIcon from '../icons/GemIcon';
import PaperPlaneIcon from '../icons/PaperPlaneIcon';

interface CouponRowProps {
  store: string;
  detail: string;
  expires: string;
  amount: number;
  onPress: () => void;
  onShare?: () => void;
  urgency?: 'expiring' | 'new' | null;
  gems?: number;
  /** True when the coupon has a pending link share — shows a "分享中" badge. */
  sharing?: boolean;
  /** Spinner state while a withdraw request for this coupon is in flight. */
  withdrawing?: boolean;
  /** When provided (coupon has a pending link share), renders a 收回 button. */
  onWithdraw?: () => void;
}

const URGENCY_COLORS = {
  expiring: colors.red,
  new: colors.green,
};

const URGENCY_LABELS = {
  expiring: '⚡ 7天到期',
  new: '✦ 新到手',
};

export default function CouponRow({
  store,
  detail,
  expires,
  amount: _amount,
  onPress,
  onShare,
  urgency,
  gems = 0,
  sharing = false,
  withdrawing = false,
  onWithdraw,
}: CouponRowProps): React.JSX.Element {
  const urColor = urgency ? URGENCY_COLORS[urgency] : null;
  const urLabel = urgency ? URGENCY_LABELS[urgency] : null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.shadowBacking} />
      <Pressable testID="coupon-row" onPress={onPress} style={styles.card}>
        <View style={styles.yellowAccent} />
        <View style={styles.content}>
          <View style={styles.info}>
            <Text style={styles.storeName}>{store}</Text>
            <Text style={styles.detail}>{detail}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.expires}>到期 {expires}</Text>
              {urLabel && urColor && (
                <View style={[styles.urgencyBadge, { backgroundColor: urColor }]}>
                  <Text style={styles.urgencyText}>{urLabel}</Text>
                </View>
              )}
              {sharing && (
                <View testID="sharing-badge" style={styles.sharingBadge}>
                  <Text style={styles.sharingText}>分享中</Text>
                </View>
              )}
              {gems > 0 && (
                <View testID="gem-reward" style={styles.gemReward}>
                  {Array.from({ length: Math.min(gems, 5) }).map((_, i) => (
                    <GemIcon key={i} size={13} color={colors.purple} />
                  ))}
                </View>
              )}
            </View>
          </View>
          <View style={styles.rightCol}>
            <View style={styles.shareBtnWrapper}>
              <View style={styles.shareBtnShadow} />
              <Pressable
                testID="coupon-share-btn"
                onPress={(e) => {
                  e.stopPropagation?.();
                  onShare?.();
                }}
                style={styles.shareBtn}
                accessibilityRole="button"
                accessibilityLabel="分享優惠券"
                hitSlop={8}
              >
                <PaperPlaneIcon size={22} color={colors.fg} />
              </Pressable>
            </View>
            {onWithdraw && (
              <Pressable
                testID="coupon-withdraw-btn"
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onWithdraw();
                }}
                disabled={withdrawing}
                style={styles.rowWithdrawBtn}
                accessibilityRole="button"
                accessibilityLabel="收回分享連結"
                hitSlop={8}
              >
                {withdrawing ? (
                  <ActivityIndicator size="small" color={colors.fg} />
                ) : (
                  <Text style={styles.rowWithdrawText}>收回</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  shadowBacking: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: -2,
    bottom: -2,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  yellowAccent: {
    width: 5,
    backgroundColor: colors.yellow,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  storeName: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    letterSpacing: -0.1,
    color: colors.fg,
    marginBottom: 2,
  },
  detail: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  expires: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: colors.muted,
  },
  urgencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  gemReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rightCol: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.subtle,
    borderStyle: 'dashed',
    paddingLeft: 12,
    minWidth: 60,
  },
  sharingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.purple,
  },
  sharingText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  rowWithdrawBtn: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.subtle,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowWithdrawText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: colors.fg,
  },
  shareBtnWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  shareBtnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  shareBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
