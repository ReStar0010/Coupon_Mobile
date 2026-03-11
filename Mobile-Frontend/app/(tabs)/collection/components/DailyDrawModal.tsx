import React, { useState, useEffect } from 'react';
// import * as Sentry from '@sentry/react-native';
import ModalErrorFallback from '@/app/components/ModalErrorFallback';
import { Modal, Dimensions } from 'react-native';
import { YStack, XStack, Text, Button, Card, Spinner, Separator } from 'tamagui';
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
      {/* <Sentry.ErrorBoundary */}
        {/* fallback={({ resetError }) => <ModalErrorFallback onDismiss={resetError} />}
        beforeCapture={(scope) => {
          scope.setTag('boundary', 'daily-draw-widget');
          scope.setTag('boundary_type', 'widget');
        }}
      > */}
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
                <Text color="$color12" marginBottom="$4" fontSize="$7" fontWeight="bold">
                  每日抽獎
                </Text>

                {isLoading ? (
                  <YStack marginBottom="$4" alignItems="center">
                    <Spinner size="large" color="#FFAD31" />
                    <Text color="$color11" marginTop="$2">
                      抽獎中，請稍候...
                    </Text>
                  </YStack>
                ) : templatesAvailable === 0 && isLoadingTemplates ? (
                  <YStack marginBottom="$4" alignItems="center">
                    <Spinner size="large" color="#FFAD31" />
                    <Text color="$color11" marginTop="$2">
                      正在載入可用優惠，請稍候...
                    </Text>
                  </YStack>
                ) : templatesAvailable === 0 ? (
                  <Text color="$color11" marginBottom="$4">
                    目前沒有可用的優惠券
                  </Text>
                ) : (
                  <Text marginBottom="$4" fontSize="$4" color="$color11">
                    目前有 {templatesAvailable} 個優惠可抽
                  </Text>
                )}

                <Button
                  onPress={onDraw}
                  disabled={isLoading || templatesAvailable === 0}
                  width="100%"
                  bg={isLoading || templatesAvailable === 0 ? '#666666' : '#FFAD31'}
                  height={48}
                  style={{ borderRadius: 12 }}
                  borderWidth={0}
                  pressStyle={{ opacity: 0.7 }}
                  opacity={isLoading || templatesAvailable === 0 ? 0.6 : 1}
                >
                  <Text
                    color={isLoading || templatesAvailable === 0 ? '#FFFFFF' : '#000000'}
                    fontSize={18}
                    fontWeight="600"
                    style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
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
                  color="$color11"
                  fontSize="$4"
                >
                  下次再抽
                </Button>
              </>
            ) : (
              <>
                {/* Draw Result - Inline content instead of nested Modal */}
                <Text
                  fontSize="$8"
                  fontWeight="bold"
                  color="$color12"
                  marginBottom="$8"
                  textAlign="center"
                >
                  {result.success ? '抽獎成功' : '抽獎結果'}
                </Text>

                <YStack marginBottom="$6" gap="$4">
                  {/* Usage Date Row */}
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="$5" color="$color11" fontWeight="500">
                      使用日期
                    </Text>
                    <Text fontSize="$5" color="$color12" fontWeight="600">
                      {new Date().toLocaleDateString('zh-TW')}
                    </Text>
                  </XStack>

                  <Separator />

                  {/* Result Info Row */}
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="$5" color="$color11" fontWeight="500">
                      {result.success ? '獲得優惠券' : '結果'}
                    </Text>
                    <Text
                      fontSize="$5"
                      color="$color12"
                      fontWeight="600"
                      maxWidth={180}
                      textAlign="right"
                      numberOfLines={2}
                    >
                      {result.success && result.coupon ? result.coupon.name : '今天沒有抽中'}
                    </Text>
                  </XStack>
                </YStack>

                {/* Complete Button */}
                <Button
                  onPress={onDrawComplete}
                  width="100%"
                  bg="#FFAD31"
                  height={48}
                  style={{ borderRadius: 12 }}
                  borderWidth={0}
                  pressStyle={{ opacity: 0.8 }}
                >
                  <Text
                    color="#000000"
                    fontSize={18}
                    fontWeight="bold"
                    style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
                  >
                    完成
                  </Text>
                </Button>
              </>
            )}
          </Card>
        </YStack>
      {/* </Sentry.ErrorBoundary> */}
    </Modal>
  );
};

export default DailyDrawModal;
