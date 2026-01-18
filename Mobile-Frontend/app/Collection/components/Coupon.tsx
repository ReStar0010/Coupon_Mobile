import React, { useCallback, useMemo } from 'react';
import { Image } from 'react-native';
import { YStack, XStack, Text, Card, View } from 'tamagui';
import { useRouter } from 'expo-router';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';
import type { CouponType } from '../utils/types';
import { getAcquisitionMethodLabel } from '../utils/couponUtils';

interface CouponProps extends Partial<CouponType> {
  className?: string;
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
}) => {
  const router = useRouter();

  const handleCouponPress = useCallback(() => {
    // Navigate directly to redeem page for exclusive coupons (Collections)
    // Skip the detail page to streamline the redemption flow
    if (id) {
      router.push(`/EasyUse/${id}/redeem?source=collection`);
    }
  }, [router, id]);

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
      elevate
      bordered
      borderRadius={BORDER_RADIUS.lg}
      padding="$4"
      onPress={handleCouponPress}
      pressStyle={{ opacity: 0.9 }}
      borderColor={COLORS.border}
      borderWidth={1}
      backgroundColor={COLORS.white}
      marginBottom="$4"
    >
      <XStack gap={15} style={{ alignItems: 'center' }}>
        <Image source={imageSource} style={{ borderRadius: BORDER_RADIUS.sm }} />

        <YStack gap={SPACING.sm} flex={1}>
          <Text
            fontSize={24}
            fontWeight="700"
            color={COLORS.text.primary}
            numberOfLines={1}
          >
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
            <XStack gap={6} flexWrap="wrap" marginTop={4}>
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
    JSON.stringify(prevProps.tags) === JSON.stringify(nextProps.tags)
  );
});
