import React, { useCallback, useMemo } from 'react';
import { Image } from 'react-native';
import { YStack, XStack, Text, Card, View } from 'tamagui';
import { useRouter } from 'expo-router';
import { COLORS, BORDER_RADIUS, SPACING } from '@/app/constants/theme';
import type { CouponType } from '@/app/(tabs)/collection/utils/types';
import { getAcquisitionMethodLabel } from '../utils/couponUtils';

interface CouponProps extends Partial<CouponType> {
  className?: string;
  onMerchantDeleted?: (storeName: string, storeId: number) => void;
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
    }}>
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
}) => {
  const router = useRouter();

  const handleCouponPress = useCallback(() => {
    // If merchant has deleted their account, show the notice modal
    if (merchantDeleted && storeId && storeName && onMerchantDeleted) {
      onMerchantDeleted(storeName, storeId);
      return;
    }
    if (!id) return;

    router.push({
      pathname: '/(tabs)/easyuse/[id]',
      params: { id: String(id), source: 'collection' },
    });
  }, [router, id, merchantDeleted, storeId, storeName, onMerchantDeleted]);

  const formattedDate = useMemo(() => {
    return expiryDate ? expiryDate.toLocaleDateString() : '';
  }, [expiryDate]);

  const imageSource = useMemo(
    () => ({
      uri: imageUrl || DEFAULT_IMAGE_URL,
      width: 64,
      height: 64,
    }),
    [imageUrl]
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
      height="auto">
      <XStack gap={15} style={{ alignItems: 'center' }}>
        <Image source={imageSource} style={{ borderRadius: BORDER_RADIUS.sm }} />

        <YStack gap={SPACING.sm} flex={1}>
          <Text fontSize={24} fontWeight="700" color={COLORS.text.primary} numberOfLines={1}>
            {storeName}
          </Text>

          <Text color={COLORS.text.secondary} numberOfLines={2}>
            {couponName}
          </Text>

          <Text fontSize="$3" color={COLORS.text.secondary} numberOfLines={1}>
            有效期限 : {formattedDate}
          </Text>

          {acquisitionMethod && (
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
    prevProps.merchantDeleted === nextProps.merchantDeleted
  );
});
