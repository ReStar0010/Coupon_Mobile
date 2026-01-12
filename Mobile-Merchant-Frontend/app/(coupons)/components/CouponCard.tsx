import React from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { colors } from '@/constants/colors';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import type { Coupon } from '../index';

interface CouponCardProps {
  coupon: Coupon & {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    redemptionCount: number;
    is_sold_out?: boolean;
  };
  onEdit: () => void;
}

export function CouponCard({ coupon, onEdit }: CouponCardProps) {
  const router = useRouter();
  const isSoldOut = coupon.is_sold_out || false;

  const handleCardPress = () => {
    if (!isSoldOut) {
      router.push(`/(coupons)/${coupon.id}`);
    }
  };

  const handleEditPress = () => {
    onEdit();
  };

  const handleStatsPress = () => {
    router.push(`/(coupons)/template-analytics/${coupon.id}`);
  };

  return (
    <TouchableOpacity 
      onPress={handleCardPress} 
      activeOpacity={isSoldOut ? 1 : 0.8}
      disabled={isSoldOut}
    >
      <YStack
        backgroundColor={isSoldOut ? colors.background : colors.white}
        borderRadius="$4"
        padding="$4"
        borderWidth={1}
        borderColor={colors.border}
        style={[
          styles.cardShadow,
          isSoldOut && styles.soldOutCard
        ]}
        opacity={isSoldOut ? 0.5 : 1}
        position="relative"
      >
        {/* Sold Out Badge */}
        {isSoldOut && (
          <View style={styles.soldOutBadge}>
            <Text style={styles.soldOutText}>已發完</Text>
          </View>
        )}

        {/* Title, Edit Icon, and Statistics Icon */}
        <XStack alignItems="center" justifyContent="space-between" marginBottom="$2">
          <Text fontSize="$lg" fontWeight="700" color={colors.textPrimary} flex={1}>
            {coupon.title}
          </Text>
          <XStack gap="$3" alignItems="center">
            <TouchableOpacity 
              onPress={handleStatsPress} 
              activeOpacity={0.7}
            >
              <MaterialIcons name="bar-chart" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEditPress} activeOpacity={0.7}>
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
  soldOutCard: {
    backgroundColor: colors.background,
  },
  soldOutBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#FF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  soldOutText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

