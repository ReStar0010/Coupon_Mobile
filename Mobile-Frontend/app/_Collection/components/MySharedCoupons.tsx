import React from 'react';
import { YStack, XStack, Text, Card, Image, View } from 'tamagui';
import { PublicShare } from '../hooks/useMyPublicShares';

interface MySharedCouponsProps {
  shares: PublicShare[];
  isLoading: boolean;
}

const MySharedCoupons: React.FC<MySharedCouponsProps> = ({ shares, isLoading }) => {
  if (isLoading) {
    return null;
  }

  // Only show pending shares (ones still in the public pool)
  const pendingShares = shares.filter(s => s.status === 'pending');

  if (pendingShares.length === 0) {
    return null;
  }

  return (
    <YStack gap={12}>
      <Text fontSize={18} fontWeight="600" color="#333">
        我的公開分享 (交換池中)
      </Text>

      {pendingShares.map((share) => (
        <Card
          key={share.share_id}
          borderRadius="$6"
          padding="$5"
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
          <XStack gap={12} alignItems="center">
            <Image
              source={{
                uri: share.image_url || 'https://api.iconify.design/mdi:gift-outline.svg?color=%23ffad31',
                width: 48,
                height: 48,
              }}
              style={{ borderRadius: 8 }}
            />

            <YStack flex={1}>
              <Text fontSize={16} fontWeight="600" color="#333" numberOfLines={1}>
                {share.coupon_name}
              </Text>
              {share.store_name && (
                <Text fontSize={14} color="#6B7280" numberOfLines={1}>
                  {share.store_name}
                </Text>
              )}
              <XStack gap={8} marginTop={4}>
                <View
                  style={{
                    backgroundColor: '#FEF3C7',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text fontSize={12} color="#D97706" fontWeight="500">
                    等待被領取
                  </Text>
                </View>
              </XStack>
            </YStack>
          </XStack>
        </Card>
      ))}
    </YStack>
  );
};

export default MySharedCoupons;
