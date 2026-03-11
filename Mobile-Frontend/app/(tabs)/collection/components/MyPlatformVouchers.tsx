import React from 'react';
import { YStack, XStack, Text, View } from 'tamagui';
import { useRouter } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { PlatformVoucherListItem } from '@/app/utils/authAPI';
import { COLORS, BORDER_RADIUS, SPACING } from '@/app/constants/theme';

interface MyPlatformVouchersProps {
  vouchers: PlatformVoucherListItem[];
  isLoading?: boolean;
}

function formatExpiry(expiryDate: string): string {
  if (!expiryDate) return '';
  try {
    const date = new Date(expiryDate);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return expiryDate;
  }
}

/** Split "100.00" into ["100", "00"] for display */
function splitFaceValue(faceValue: string): { int: string; dec: string } {
  const s = String(faceValue ?? '').trim();
  const dot = s.indexOf('.');
  if (dot >= 0) {
    return { int: s.slice(0, dot), dec: s.slice(dot) };
  }
  return { int: s, dec: '' };
}

const MyPlatformVouchers: React.FC<MyPlatformVouchersProps> = ({
  vouchers,
  isLoading = false,
}) => {
  const router = useRouter();

  // 僅在「初次載入且尚無資料」時不顯示；刷新時保留既有列表，與下方 Collection 優惠券行為一致
  if (isLoading && vouchers.length === 0) {
    return null;
  }

  if (!vouchers.length) {
    return null;
  }

  return (
    <YStack gap={SPACING.md}>
      <XStack alignItems="center" gap={SPACING.sm}>
        <View style={styles.sectionBadge}>
          <Text fontSize={12} fontWeight="600" color={COLORS.primary}>
            現金券
          </Text>
        </View>
        <Text fontSize={18} fontWeight="700" color="#1f2937">
          我的現金券
        </Text>
      </XStack>

      {vouchers.map((voucher) => {
        const { int: valueInt, dec: valueDec } = splitFaceValue(voucher.face_value);
        return (
          <TouchableOpacity
            key={voucher.id}
            activeOpacity={0.75}
            onPress={() => router.push(`/(tabs)/collection/voucher/${voucher.id}`)}
            style={styles.cardWrap}
          >
            <View style={styles.card}>
              <View style={styles.leftAccent} />
              <View style={styles.amountBlock}>
                <Text style={styles.currencySymbol}>NT$</Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amountInt}>{valueInt}</Text>
                  {valueDec ? <Text style={styles.amountDec}>{valueDec}</Text> : null}
                </View>
              </View>
              <View style={styles.content}>
                <Text style={styles.batchName} numberOfLines={2}>
                  {voucher.batch_name || '平台現金券'}
                </Text>
                <View style={styles.expiryRow}>
                  <Text style={styles.expiryLabel}>有效期限</Text>
                  <Text style={styles.expiryValue}>{formatExpiry(voucher.expiry_date)}</Text>
                </View>
              </View>
              <View style={styles.chevron}>
                <ChevronRight size={20} color="#9ca3af" />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </YStack>
  );
};

const styles = StyleSheet.create({
  sectionBadge: {
    backgroundColor: COLORS.tag.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  cardWrap: {
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    minHeight: 88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  leftAccent: {
    width: 4,
    backgroundColor: COLORS.primary,
  },
  amountBlock: {
    width: 96,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingVertical: SPACING.md,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amountInt: {
    fontSize: 22,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: -0.5,
  },
  amountDec: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
    marginLeft: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  batchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
  },
  expiryRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expiryLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9ca3af',
  },
  expiryValue: {
    fontSize: 13,
    color: '#6b7280',
  },
  chevron: {
    justifyContent: 'center',
    paddingRight: SPACING.sm,
  },
});

export default MyPlatformVouchers;
