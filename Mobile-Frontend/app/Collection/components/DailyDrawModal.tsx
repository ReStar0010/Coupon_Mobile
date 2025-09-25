import React, { useState, useEffect } from 'react';
import { Modal, Dimensions } from 'react-native';
import { 
  YStack, 
  Text, 
  Button, 
  Card,
  Spinner
} from 'tamagui';
import SuccessPopup from '../../EasyUse/[id]/redeem/SuccessPopup';
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
            <SuccessPopup
              isOpen={true}
              onClose={() => {
                onDrawComplete();
              }}
              storeName={result.success ? '恭喜抽中' : '明天再加油'}
              couponDetail={result.success && result.coupon ? result.coupon.name : '今天沒有抽中'}
              titleType={result.success ? '抽獎成功' : '抽獎結果'}
            />
          )}
        </Card>
      </YStack>
    </Modal>
  );
};

export default DailyDrawModal;
