import React, { useState } from 'react';
import { YStack, XStack, Text, Button, Card, Spinner } from 'tamagui';
import { useRouter } from 'expo-router';
import SuccessPopup from '../../easyuse/[id]/redeem/SuccessPopup';
import { isUserLoggedIn, fetchAPI } from '@/app/utils/authAPI';
import { useApiError } from '@/app/hooks/useApiError';
import { devLog } from '@/app/utils/devLogger';
import Toast from 'react-native-toast-message';

export type VoucherGiftProps = {
  token?: string;
  voucherInfo?: {
    face_value: string;
    currency_code: string;
    from_user_email: string;
  };
  onAccepted?: () => void;
};

const VoucherGift: React.FC<VoucherGiftProps> = ({
  token,
  voucherInfo,
  onAccepted,
}) => {
  const { getErrorMessage } = useApiError();
  const [isAccepting, setIsAccepting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const router = useRouter();

  const handleAccept = async () => {
    if (!token) return;

    if (!isUserLoggedIn()) {
      devLog('User not logged in. Redirecting to login page with voucher token');
      const returnUrl = `/(tabs)/collection?token=${token}&shareType=voucher`;
      router.push(`/Login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsAccepting(true);

    try {
      await fetchAPI(`/platform-voucher/share/${token}/accept/`, {
        method: 'POST',
      });

      devLog('Voucher gift accepted');
      setAcceptSuccess(true);
      setShowSuccessPopup(true);
    } catch (err: unknown) {
      console.error('Error accepting voucher gift:', err);
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

  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);

    if (acceptSuccess && onAccepted) {
      onAccepted();
    }

    router.push('/(tabs)/collection');
  };

  if (acceptSuccess && !showSuccessPopup) {
    return null;
  }

  const displayName =
    voucherInfo?.face_value && voucherInfo?.currency_code
      ? `${voucherInfo.currency_code} ${voucherInfo.face_value} 現金券`
      : '現金券';

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
          <YStack marginRight="$4" flex={1}>
            <Text
              color="$color"
              marginBottom="$2"
              fontSize="$6"
              fontWeight="bold"
              numberOfLines={2}
            >
              🎁 來自好友的現金券
            </Text>

            {voucherInfo && (
              <>
                <Text fontSize="$4" color="$gray10" numberOfLines={2} marginBottom="$1">
                  {displayName}
                </Text>
                <Text fontSize="$3" color="$gray8" numberOfLines={1}>
                  分享者：{voucherInfo.from_user_email}
                </Text>
              </>
            )}

          </YStack>

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
                領取
              </Text>
            )}
          </Button>
        </XStack>
      </Card>

      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={handleCloseSuccessPopup}
        storeName={voucherInfo?.from_user_email || '好友'}
        couponDetail={displayName}
        titleType="領取成功"
      />
    </>
  );
};

export default VoucherGift;
