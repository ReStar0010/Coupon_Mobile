import React, { useState, useEffect } from 'react';
import { Modal, Dimensions } from 'react-native';
import { 
  YStack, 
  XStack,
  Text, 
  Button, 
  Card,
  Spinner,
  Separator
} from 'tamagui';
import { DailyDrawResult } from '../utils/types';

interface DailyDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDraw: () => void;
  onDrawComplete: () => void;
  result: DailyDrawResult | null;
  isLoading: boolean;
  templatesAvailable: number;
}

const { width } = Dimensions.get('window');

const DailyDrawModal: React.FC<DailyDrawModalProps> = ({
  isOpen,
  onClose,
  onDraw,
  onDrawComplete,
  result,
  isLoading,
  templatesAvailable,
}) => {
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  useEffect(() => {
    if (isOpen && templatesAvailable === 0) {
      setIsLoadingTemplates(true);
      const timer = setTimeout(() => {
        setIsLoadingTemplates(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, templatesAvailable]);

  return (
    <Modal visible={isOpen} transparent={true} animationType="fade" onRequestClose={onClose}>
      <YStack 
        flex={1} 
        alignItems="center" 
        justifyContent="center" 
        backgroundColor="rgba(0,0,0,0.5)"
      >
        <Card
          alignItems="center"
          borderRadius="$4"
          backgroundColor="$background"
          padding="$6"
          maxWidth={width * 0.9}
          width={Math.min(350, width * 0.9)}
        >
          {!result ? (
            <>
              <Text 
                color="$color" 
                marginBottom="$4" 
                fontSize="$7" 
                fontWeight="bold"
              >
                每日抽獎
              </Text>

              {isLoading ? (
                <YStack marginBottom="$4" alignItems="center">
                  <Spinner size="large" color="#FFAD31" />
                  <Text color="$color" marginTop="$2">抽獎中，請稍候...</Text>
                </YStack>
              ) : templatesAvailable === 0 && isLoadingTemplates ? (
                <YStack marginBottom="$4" alignItems="center">
                  <Spinner size="large" color="#FFAD31" />
                  <Text color="$color" marginTop="$2">正在載入可用優惠，請稍候...</Text>
                </YStack>
              ) : templatesAvailable === 0 ? (
                <Text color="$color" marginBottom="$4">目前沒有可用的優惠券</Text>
              ) : (
                <Text marginBottom="$4" fontSize="$4" color="$gray10">
                  目前有 {templatesAvailable} 個優惠可抽
                </Text>
              )}

              <Button
                onPress={onDraw}
                disabled={isLoading || templatesAvailable === 0}
                width="100%"
                backgroundColor={isLoading || templatesAvailable === 0 ? '$gray8' : '#FFAD31'}
                borderRadius="$3"
                paddingHorizontal="$6"
                paddingVertical="$3"
                pressStyle={{ opacity: 0.7 }}
              >
                <Text 
                  color={isLoading || templatesAvailable === 0 ? '$gray11' : '#000'} 
                  fontSize="$6" 
                  fontWeight="600"
                >
                  {isLoading
                    ? '抽獎中...'
                    : templatesAvailable === 0 && !isLoadingTemplates
                      ? '無可用優惠'
                      : '立即抽獎'}
                </Text>
              </Button>

              <Button 
                onPress={onClose} 
                marginTop="$4"
                backgroundColor="transparent"
                pressStyle={{ opacity: 0.7 }}
              >
                <Text fontSize="$4" color="$gray10">下次再抽</Text>
              </Button>
            </>
          ) : (
            <>
              {/* Draw Result - Inline content instead of nested Modal */}
              <Text 
                fontSize="$8" 
                fontWeight="bold" 
                color="$color" 
                marginBottom="$8"
                textAlign="center"
              >
                {result.success ? '抽獎成功' : '抽獎結果'}
              </Text>

              <YStack marginBottom="$6" gap="$4">
                {/* Usage Date Row */}
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="$5" color="$gray10" fontWeight="500">
                    使用日期
                  </Text>
                  <Text fontSize="$5" color="$color" fontWeight="600">
                    {new Date().toLocaleDateString('zh-TW')}
                  </Text>
                </XStack>

                <Separator />

                {/* Result Info Row */}
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="$5" color="$gray10" fontWeight="500">
                    {result.success ? '獲得優惠券' : '結果'}
                  </Text>
                  <Text 
                    fontSize="$5" 
                    color="$color" 
                    fontWeight="600"
                    maxWidth={180}
                    textAlign="right"
                    numberOfLines={2}
                  >
                    {result.success && result.coupon 
                      ? result.coupon.name 
                      : '今天沒有抽中'}
                  </Text>
                </XStack>
              </YStack>

              {/* Complete Button */}
              <Button
                onPress={onDrawComplete}
                width="100%"
                backgroundColor="#FFAD31"
                borderRadius="$4"
                paddingVertical="$4"
                pressStyle={{ opacity: 0.8 }}
              >
                <Text color="#000" fontSize="$6" fontWeight="bold">
                  完成
                </Text>
              </Button>
            </>
          )}
        </Card>
      </YStack>
    </Modal>
  );
};

export default DailyDrawModal;
