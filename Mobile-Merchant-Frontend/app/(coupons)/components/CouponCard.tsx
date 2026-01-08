import React from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { colors } from '@/constants/colors';
import { TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import type { Coupon } from '../index';

interface CouponCardProps {
  coupon: Coupon;
  onEdit: () => void;
}

export function CouponCard({ coupon, onEdit }: CouponCardProps) {
  const router = useRouter();

  const handleCardPress = () => {
    router.push(`/(coupons)/${coupon.id}`);
  };

  return (
    <TouchableOpacity onPress={handleCardPress} activeOpacity={0.8}>
      <YStack
        backgroundColor={colors.white}
        borderRadius="$4"
        padding="$4"
        borderWidth={1}
        borderColor={colors.border}
        style={styles.cardShadow}
      >
      {/* Title, Edit Icon, and Statistics Icon */}
      <XStack alignItems="center" justifyContent="space-between" marginBottom="$2">
        <Text fontSize="$lg" fontWeight="700" color={colors.textPrimary} flex={1}>
          {coupon.title}
        </Text>
        <XStack gap="$3" alignItems="center">
          <TouchableOpacity 
            onPress={() => router.push(`/(coupons)/template-analytics/${coupon.id}`)} 
            activeOpacity={0.7}
          >
            <MaterialIcons name="bar-chart" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
            <MaterialIcons name="edit" size={18} color={colors.primary} />
          </TouchableOpacity>
        </XStack>
      </XStack>

      {/* Date Range */}
      <Text fontSize="$sm" color={colors.textSecondary} marginBottom="$1.5">
        {coupon.startDate} ~ {coupon.endDate}
      </Text>

      {/* Usage Count */}
      <Text fontSize="$sm" color={colors.textSecondary}>
        已發出: {coupon.redemptionCount}
      </Text>
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
});

