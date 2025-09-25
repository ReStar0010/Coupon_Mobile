import React, { useCallback, useState } from 'react';
import { Image } from 'react-native';
import { 
  YStack, 
  XStack, 
  Text, 
  Button, 
  Card,
  Spinner
} from 'tamagui';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useToast } from '../../components/ToastContext';
import { generateShareLink } from '../utils/couponUtils';
import type { CouponType } from '../utils/types';

interface CouponProps extends Partial<CouponType> {
  className?: string;
}

const Coupon: React.FC<CouponProps> = ({
  className = '',
  couponName,
  description,
  storeName,
  expiryDate,
  id,
  imageUrl,
}) => {
  const router = useRouter();
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Use the ToastContext to access global toast notifications
  const { showToast } = useToast();

  const onCouponClick = useCallback(() => {
    router.push(`/EasyUse/${id}?source=collection`);
  }, [router, id]);

  const handleShare = async () => {
    setIsSharing(true);
    setShareError(null);

    if (!id) {
      setShareError('無法分享：優惠券ID不存在');
      setIsSharing(false);
      return;
    }

    try {
      const link = await generateShareLink(id);

      if (link) {
        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();

        if (isAvailable) {
          try {
            await Sharing.shareAsync(link, {
              dialogTitle: `分享優惠券 - ${storeName}`,
            });
            showToast('成功分享優惠券', 'success');
          } catch (shareError) {
            console.error('Error sharing:', shareError);
            // Fall back to clipboard copy if sharing fails
            await fallbackCopyToClipboard(link);
          }
        } else {
          // No sharing support, use clipboard fallback
          await fallbackCopyToClipboard(link);
        }
      } else {
        setShareError('無法建立分享連結');
      }
    } catch (err: any) {
      console.error('Error sharing coupon:', err);
      setShareError(err?.response?.data?.error || '分享失敗，請稍後再試。');
    } finally {
      setIsSharing(false);
    }
  };

  // Fallback method to copy to clipboard
  const fallbackCopyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      showToast('已複製分享連結到剪貼簿', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      setShareError('複製失敗，請手動分享。');
    }
  };

  return (
    <Card
      elevate
      bordered
      borderRadius="$5"
      padding="$4"
      onPress={onCouponClick}
      pressStyle={{ opacity: 0.9 }}
      borderColor="#f8f8f8"
      borderWidth={1}
      backgroundColor="white"
      marginBottom="$4"
    >
      <XStack gap={15} style={{ alignItems: 'center' }}>
        {/* Store Image */}
        <Image
          source={{
            uri: imageUrl || 'https://api.iconify.design/material-symbols:storefront-rounded.svg?color=%23ffad31',
            width: 64,
            height: 64,
          }}
          style={{ borderRadius: 8 }}
        />

        {/* Content */}
        <YStack gap={8} flex={1}>
          <Text fontSize={24} fontWeight="700" color="#000000" numberOfLines={1}>
            {storeName}
          </Text>
          
          <Text color="#6b7280" numberOfLines={2}>
            {couponName}
          </Text>
          
          <Text fontSize="$3" color="#6b7280" numberOfLines={1}>
            有效期限 : {expiryDate ? expiryDate.toLocaleDateString() : ''}
          </Text>
        </YStack>

        {/* Share button */}
        <Button
          onPress={handleShare}
          disabled={isSharing}
          backgroundColor="#FFAD31"
          borderRadius="$3"
          padding="$2"
          opacity={isSharing ? 0.7 : 1}
          pressStyle={{ opacity: 0.7 }}
        >
          {isSharing ? (
            <Spinner size="small" color="#000" />
          ) : (
            <Text fontSize="$5" color="#000">📤</Text>
          )}
        </Button>
      </XStack>

      {/* Error message */}
      {shareError && (
        <Text 
          position="absolute" 
          bottom="$1" 
          right="$3"
          fontSize="$2" 
          color="#ef4444"
        >
          {shareError}
        </Text>
      )}
    </Card>
  );
};

export default Coupon;
