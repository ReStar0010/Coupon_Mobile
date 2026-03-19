import React, { useState } from 'react';
import { YStack, XStack, Text, Button, Card, Spinner } from 'tamagui';
import { useRouter } from 'expo-router';
import SuccessPopup from '../easyuse/[id]/redeem/SuccessPopup';
import { isUserLoggedIn, fetchAPI } from '@/app/utils/authAPI';
import { useApiError } from '@/app/hooks/useApiError';
import { devLog } from '@/app/utils/devLogger';
import Toast from 'react-native-toast-message';

export type GiftType = {
  className?: string;
  description?: string;
  GiftType?: string;
  ReceiveType?: string;
  token?: string;
  couponInfo?: {
    id: number;
    name: string;
    fromUser: string;
  };
  onAccepted?: () => void;
};

const Gift: React.FC<GiftType> = ({
  className = '',
  description,
  GiftType,
  ReceiveType,
  token,
  couponInfo,
  onAccepted,
}) => {
  const { getErrorMessage } = useApiError();
  const [isAccepting, setIsAccepting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const router = useRouter();

  // Handle accepting a shared coupon
  const handleAccept = async () => {
    if (!token) return;

    // Check if the user is logged in before accepting the gift
    if (!isUserLoggedIn()) {
      devLog('User not logged in. Redirecting to login page with token');
      const returnUrl = `/(tabs)/collection?token=${token}`;
      router.push(`/Login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsAccepting(true);

    try {
      const response = await fetchAPI(`/coupon/share/${token}/accept/`, {
        method: 'POST',
      });

      devLog('Gift accepted:', response.data);
      setAcceptSuccess(true);
      setShowSuccessPopup(true);
    } catch (err: unknown) {
      console.error('Error accepting gift:', err);
      Toast.show({
        type: 'failRed',
        text1: getErrorMessage(err),
        position: 'bottom',
        visibilityTime: 3500,
        autoHide: true,
      });
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle closing the success popup
  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);

    if (acceptSuccess && onAccepted) {
      onAccepted();
    }

    router.push('/(tabs)/collection');
  };

  // Don't render if already accepted
  if (acceptSuccess && !showSuccessPopup) {
    return null;
  }

  return (
    <>
      <Card
        alignSelf="stretch"
        borderRadius="$4"
        shadowColor="$shadowColor"
        shadowOffset={{ width: 0, height: 2 }}
        shadowOpacity={0.25}
        shadowRadius={10}
        elevation={4}
        minHeight={120}
        backgroundColor="$background"
        marginVertical="$1"
      >
        <XStack
          flex={1}
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$6"
          paddingVertical="$4"
        >
          {/* Left side - Gift info */}
          <YStack marginRight="$4" flex={1}>
            <Text
              color="$color"
              marginBottom="$2"
              fontSize="$6"
              fontWeight="bold"
              numberOfLines={2}
            >
              🎁 {GiftType || (couponInfo ? `來自好友的優惠券` : '優惠券禮物')}
            </Text>

            {couponInfo && (
              <>
                <Text fontSize="$4" color="$gray10" numberOfLines={2} marginBottom="$1">
                  {couponInfo.name}
                </Text>
                <Text fontSize="$3" color="$gray8" numberOfLines={1}>
                  分享者：{couponInfo.fromUser}
                </Text>
              </>
            )}

          </YStack>

          {/* Right side - Action button */}
          <Button
            backgroundColor="#FFAD31"
            minWidth={80}
            alignItems="center"
            justifyContent="center"
            borderRadius="$4"
            paddingHorizontal="$6"
            paddingVertical="$3"
            onPress={token ? handleAccept : undefined}
            disabled={isAccepting || !token}
            opacity={isAccepting ? 0.7 : 1}
            pressStyle={{ opacity: 0.7 }}
          >
            {isAccepting ? (
              <XStack alignItems="center">
                <Spinner size="small" color="#000" />
                <Text color="#000" marginLeft="$2" fontSize="$4" fontWeight="bold">
                  處理中
                </Text>
              </XStack>
            ) : (
              <Text color="#000" fontSize="$5" fontWeight="bold">
                {ReceiveType || '領取'}
              </Text>
            )}
          </Button>
        </XStack>
      </Card>

      {/* Success Popup */}
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={handleCloseSuccessPopup}
        storeName={couponInfo?.fromUser || '好友'}
        couponDetail={couponInfo?.name || '優惠券'}
        titleType="領取成功"
      />
    </>
  );
};

export default Gift;
