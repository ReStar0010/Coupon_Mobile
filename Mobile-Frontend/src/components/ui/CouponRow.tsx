import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
  amount,
  onPress,
  onShare,
  urgency,
  gems = 0,
}: CouponRowProps): React.JSX.Element {
  const urColor = urgency ? URGENCY_COLORS[urgency] : null;
  const urLabel = urgency ? URGENCY_LABELS[urgency] : null;
  const gemCount = Math.min(gems, 3);

  return (
    <View style={styles.wrapper}>
      <View style={styles.shadowBacking} />
      <Pressable
        testID="coupon-row"
        onPress={onPress}
        style={styles.card}
      >
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
            </View>
          </View>
          <View style={styles.rightCol}>
            <View style={styles.shareBtnWrapper}>
              <View style={styles.shareBtnShadow} />
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onShare?.();
                }}
                style={styles.shareBtn}
              >
                <PaperPlaneIcon size={15} color={colors.fg} />
              </Pressable>
            </View>
            <View style={styles.gems}>
              {Array.from({ length: gemCount }).map((_, i) => (
                <GemIcon key={i} size={11} color={colors.purple} />
              ))}
            </View>
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
    alignItems: 'stretch',
    padding: 10,
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
    gap: 6,
    marginTop: 5,
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
  rightCol: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 2,
    borderLeftColor: colors.subtle,
    borderStyle: 'dashed',
    paddingLeft: 10,
    minWidth: 50,
  },
  shareBtnWrapper: {
    position: 'relative',
  },
  shareBtnShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  shareBtn: {
    width: 32,
    height: 32,
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gems: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 4,
  },
});
