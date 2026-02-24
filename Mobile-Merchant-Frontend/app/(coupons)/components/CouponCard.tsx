import React from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { colors } from '@/constants/colors';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

interface CouponCardProps {
  coupon: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    redemptionCount: number;
    enableSoldOutUI?: boolean; // Only Collections-type coupons should use Sold Out UI
    remainingQuantity?: number;
    isExclusiveCoupon?: boolean; // true = 專屬優惠 (can open QR/send page), false = 隨取即用 (cannot)
  };
  onEdit: () => void;
}

export function CouponCard({ coupon, onEdit }: CouponCardProps) {
  const router = useRouter();
  const isSoldOut =
    coupon.enableSoldOutUI === true &&
    typeof coupon.remainingQuantity === 'number' &&
    coupon.remainingQuantity <= 0;

  const canOpenRedemptionPage = !isSoldOut && coupon.isExclusiveCoupon !== false;

  return (
    <TouchableOpacity
      onPress={() => {
        // Only allow entering the phone/QR entry screen for 專屬優惠 and when not sold out.
        if (!canOpenRedemptionPage) return;
        router.push(`/(coupons)/${coupon.id}`);
      }}
      activeOpacity={canOpenRedemptionPage ? 0.85 : 1}
    >
      <YStack
        backgroundColor={isSoldOut ? colors.background : colors.white}
        borderRadius="$4"
        paddingHorizontal="$4"
        paddingTop="$2"
        paddingBottom="$4"
        borderWidth={1}
        borderColor={colors.border}
        style={[styles.cardShadow, isSoldOut ? styles.soldOutCard : undefined]}
      >
        {/* Title, Edit Icon, and Statistics Icon */}
        <XStack alignItems="center" justifyContent="space-between" marginBottom="$2">
          <XStack flex={1} alignItems="center" gap="$2" minWidth={0}>
            <Text
              fontSize="18"
              fontWeight="700"
              color={colors.textPrimary}
              flex={1}
              numberOfLines={1}
            >
              {coupon.title}
            </Text>
          </XStack>
          <XStack gap="$2" alignItems="center">
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/(coupons)/template-analytics/${coupon.id}`);
              }}
              activeOpacity={0.7}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.iconButtonInner}>
                <MaterialIcons name="bar-chart" size={ICON_SIZE} color={colors.primary} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              activeOpacity={0.7}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.iconButtonInner}>
                <MaterialIcons name="edit" size={ICON_SIZE} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </XStack>
        </XStack>

        {/* Date Range */}
        <Text fontSize="$sm" color={colors.textSecondary} marginBottom="$1.5">
          {coupon.startDate} ~ {coupon.endDate}
        </Text>

        {/* Usage Count + Sold out badge (bottom-right) */}
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize="$sm" color={colors.textSecondary}>
            已發出: {coupon.redemptionCount}
          </Text>
          {isSoldOut ? (
            <YStack
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$10"
              backgroundColor="rgba(239, 68, 68, 0.12)"
              borderWidth={1}
              borderColor="rgba(239, 68, 68, 0.35)"
            >
              <Text fontSize="$xs" fontWeight="700" color={colors.error}>
                已發完
              </Text>
            </YStack>
          ) : null}
        </XStack>
      </YStack>
    </TouchableOpacity>
  );
}

const ICON_BUTTON_SIZE = 44; // Min touch target (Apple HIG ~44pt)
const ICON_SIZE = 22;

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  soldOutCard: {
    // Subtle tint (not disabled/greyed out), keeps text fully legible.
    backgroundColor: 'rgba(255, 173, 49, 0.06)',
  },
  iconButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonInner: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ICON_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255, 173, 49, 0.14)',
  },
});
