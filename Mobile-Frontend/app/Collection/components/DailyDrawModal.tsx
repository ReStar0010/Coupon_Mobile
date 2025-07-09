import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Dimensions } from "react-native";
import SuccessPopup from "../../EasyUse/[id]/redeem/SuccessPopup";
import { DailyDrawResult } from "../utils/types";

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
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 items-center justify-center">
        <View 
          className="bg-white p-6 rounded-xl items-center"
          style={{ 
            maxWidth: width * 0.9,
            width: Math.min(350, width * 0.9)
          }}
        >
          {!result ? (
            <>
              <Text className="text-xl font-bold mb-4 text-sec-black">每日抽獎</Text>
              
              {isLoading ? (
                <View className="items-center mb-4">
                  <ActivityIndicator size="large" color="#FFAD31" />
                  <Text className="text-sec-black mt-2">抽獎中，請稍候...</Text>
                </View>
              ) : templatesAvailable === 0 && isLoadingTemplates ? (
                <View className="items-center mb-4">
                  <ActivityIndicator size="large" color="#FFAD31" />
                  <Text className="text-sec-black mt-2">正在載入可用優惠，請稍候...</Text>
                </View>
              ) : templatesAvailable === 0 ? (
                <Text className="mb-4 text-sec-black">目前沒有可用的優惠券</Text>
              ) : (
                <Text className="mb-4 text-sm text-gray-600">
                  目前有 {templatesAvailable} 個優惠可抽
                </Text>
              )}
              
              <TouchableOpacity
                onPress={onDraw}
                disabled={isLoading || templatesAvailable === 0}
                className={`rounded-lg px-6 py-3 w-full items-center justify-center ${
                  isLoading || templatesAvailable === 0
                    ? "bg-gray-300"
                    : "bg-act-yellow"
                }`}
                activeOpacity={0.7}
              >
                <Text className="text-lg font-semibold text-sec-black">
                  {isLoading 
                    ? "抽獎中..." 
                    : templatesAvailable === 0 && !isLoadingTemplates 
                      ? "無可用優惠" 
                      : "立即抽獎"
                  }
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={onClose} className="mt-4">
                <Text className="text-gray-500 text-sm">下次再抽</Text>
              </TouchableOpacity>
            </>
          ) : (
            <SuccessPopup
              isOpen={true}
              onClose={() => {
                onDrawComplete();
              }}
              storeName={result.success ? "恭喜抽中" : "明天再加油"}
              couponDetail={
                result.success && result.coupon
                  ? result.coupon.name
                  : "今天沒有抽中"
              }
              titleType={result.success ? "抽獎成功" : "抽獎結果"}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

export default DailyDrawModal;