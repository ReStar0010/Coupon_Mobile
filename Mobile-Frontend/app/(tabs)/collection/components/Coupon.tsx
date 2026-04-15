import React, { useCallback, useMemo } from 'react';
import { Image, Pressable } from 'react-native';
import { YStack, XStack, Text, Card, View } from 'tamagui';
import { useRouter } from 'expo-router';
import { COLORS, BORDER_RADIUS, SPACING } from '@/app/constants/theme';
import type { CouponType } from '@/app/(tabs)/collection/utils/types';
import { getAcquisitionMethodLabel } from '../utils/couponUtils';

interface CouponProps extends Partial<CouponType> {
  className?: string;
  onMerchantDeleted?: (storeName: string, storeId: number) => void;
  /** When set, this coupon is in the public pool; show withdraw UI */
  shareIdInPool?: number;
  onWithdrawFromPool?: (shareId: number) => void;
  /** Label when coupon is in pool (e.g. "交換池中") */
  inPoolLabel?: string;
}

const DEFAULT_IMAGE_URL =
  'https://api.iconify.design/material-symbols:storefront-rounded.svg?color=%23ffad31';

interface CouponTagProps {
  tag: string;
}

const CouponTag: React.FC<CouponTagProps> = React.memo(({ tag }) => (
  <View
    style={{
      backgroundColor: COLORS.tag.background,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
    }}
  >
    <Text fontSize={12} color={COLORS.tag.text} fontWeight="500">
      {tag}
    </Text>
  </View>
));

CouponTag.displayName = 'CouponTag';

const Coupon: React.FC<CouponProps> = ({
  couponName,
  storeName,
  expiryDate,
  id,
  imageUrl,
  tags,
  acquisitionMethod,
  storeId,
  merchantDeleted,
  onMerchantDeleted,
  shareIdInPool,
  onWithdrawFromPool,
  inPoolLabel = '交換池中',
}) => {
  const router = useRouter();
  const isInPool = shareIdInPool != null;

  const handleCouponPress = useCallback(() => {
    if (isInPool) return; // In-pool cards only act via withdraw button
    if (merchantDeleted && storeId && storeName && onMerchantDeleted) {
      onMerchantDeleted(storeName, storeId);
      return;
    }
    if (!id) return;

    router.push({
      pathname: '/(tabs)/easyuse/[id]',
      params: { id: String(id), source: 'collection' },
    });
  }, [isInPool, router, id, merchantDeleted, storeId, storeName, onMerchantDeleted]);

  const handleWithdrawPress = useCallback(() => {
    if (shareIdInPool != null && onWithdrawFromPool) {
      onWithdrawFromPool(shareIdInPool);
    }
  }, [shareIdInPool, onWithdrawFromPool]);

  const formattedDate = useMemo(() => {
    return expiryDate ? expiryDate.toLocaleDateString() : '';
  }, [expiryDate]);

  const imageSource = useMemo(
    () => ({
      uri: imageUrl || DEFAULT_IMAGE_URL,
      width: 64,
      height: 64,
    }),
    [imageUrl],
  );

  return (
    <Card
      borderRadius="$6"
      padding="$5"
      onPress={handleCouponPress}
      pressStyle={{ opacity: 0.9 }}
      borderColor="#e5e5e5"
      borderWidth={1}
      backgroundColor="white"
      shadowColor="black"
      shadowRadius={8}
      shadowOffset={{ width: 0, height: 2 }}
      shadowOpacity={0.08}
      elevation={3}
      height="auto"
    >
      <XStack gap={15} style={{ alignItems: 'center' }}>
        <Image source={imageSource} style={{ borderRadius: BORDER_RADIUS.sm }} />

        <YStack gap={SPACING.sm} flex={1}>
          <Text fontSize={24} fontWeight="700" color={COLORS.text.primary} numberOfLines={1}>
            {storeName}
          </Text>

          <Text color={COLORS.text.secondary} numberOfLines={2}>
            {couponName}
          </Text>

          {isInPool && (
            <XStack gap={8} flexWrap="wrap" style={{ marginTop: 2 }}>
              <View
                style={{
                  backgroundColor: '#FEF3C7',
                  borderRadius: BORDER_RADIUS.md,
                  paddingHorizontal: SPACING.sm,
                  paddingVertical: SPACING.xs,
                }}
              >
                <Text fontSize={12} color="#D97706" fontWeight="500">
                  等待對方回覆
                </Text>
              </View>
            </XStack>
          )}

          <Text fontSize="$3" color={COLORS.text.secondary} numberOfLines={1}>
            {isInPool ? `狀態 : ${inPoolLabel}` : `有效期限 : ${formattedDate}`}
          </Text>

          {isInPool && shareIdInPool != null && onWithdrawFromPool && (
            <View style={{ marginTop: 4 }}>
              <Pressable
                onPress={handleWithdrawPress}
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  backgroundColor: COLORS.primary,
                  borderRadius: BORDER_RADIUS.md,
                  paddingHorizontal: SPACING.md,
                  paddingVertical: SPACING.sm,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text fontSize={14} color="white" fontWeight="600">
                  收回
                </Text>
              </Pressable>
            </View>
          )}

          {!isInPool && acquisitionMethod && (
            <Text fontSize="$3" color={COLORS.text.secondary} numberOfLines={1}>
              取得方式 : {getAcquisitionMethodLabel(acquisitionMethod)}
            </Text>
          )}

          {tags && tags.length > 0 && (
            <XStack gap={6} flexWrap="wrap" style={{ marginTop: 4 }}>
              {tags.map((tag, index) => (
                <CouponTag key={`${tag}-${index}`} tag={tag} />
              ))}
            </XStack>
          )}
        </YStack>
      </XStack>
    </Card>
  );
};

export default React.memo(Coupon, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.couponName === nextProps.couponName &&
    prevProps.storeName === nextProps.storeName &&
    prevProps.expiryDate?.getTime() === nextProps.expiryDate?.getTime() &&
    prevProps.imageUrl === nextProps.imageUrl &&
    JSON.stringify(prevProps.tags) === JSON.stringify(nextProps.tags) &&
    prevProps.storeId === nextProps.storeId &&
    prevProps.merchantDeleted === nextProps.merchantDeleted &&
    prevProps.shareIdInPool === nextProps.shareIdInPool
  );
});
