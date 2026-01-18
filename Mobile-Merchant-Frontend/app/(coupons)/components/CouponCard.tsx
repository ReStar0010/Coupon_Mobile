import React from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { colors } from '@/constants/colors';
import { TouchableOpacity, StyleSheet } from 'react-native';
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
  };
  onEdit: () => void;
}

export function CouponCard({ coupon, onEdit }: CouponCardProps) {
  const router = useRouter();
  const isSoldOut =
    coupon.enableSoldOutUI === true &&
    typeof coupon.remainingQuantity === 'number' &&
    coupon.remainingQuantity <= 0;

  return (
    <TouchableOpacity
      onPress={() => {
        // Only allow entering the phone/QR entry screen when not sold out.
        if (isSoldOut) return;
        router.push(`/(coupons)/${coupon.id}`);
      }}
      activeOpacity={isSoldOut ? 1 : 0.85}
    >
      <YStack
        backgroundColor={colors.white}
        borderRadius="$4"
        padding="$4"
        borderWidth={1}
        borderColor={colors.border}
        style={[styles.cardShadow, isSoldOut ? styles.soldOutCard : undefined]}
      >
        {/* Title, Edit Icon, and Statistics Icon */}
        <XStack alignItems="center" justifyContent="space-between" marginBottom="$2">
          <XStack flex={1} alignItems="center" gap="$2" minWidth={0}>
            <Text fontSize="$lg" fontWeight="700" color={colors.textPrimary} flex={1} numberOfLines={1}>
              {coupon.title}
            </Text>
          </XStack>
          <XStack gap="$3" alignItems="center">
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/(coupons)/template-analytics/${coupon.id}`);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="bar-chart" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="edit" size={18} color={colors.primary} />
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
});

