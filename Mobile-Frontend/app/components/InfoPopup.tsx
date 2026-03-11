import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, Dimensions } from 'react-native';

interface InfoPopupProps {
  title: string;
  children: React.ReactNode;
}

const { width } = Dimensions.get('window');

const InfoPopup: React.FC<InfoPopupProps> = ({ title, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleIconPress = () => {
    setIsVisible(true);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <View className="relative inline-block align-middle">
      {/* Info Icon Button */}
      <TouchableOpacity
        onPress={handleIconPress}
        className="ml-2 inline-block align-middle"
        activeOpacity={0.7}
      >
        <Image
          className="relative h-5 w-5 object-cover"
          style={{ width: 20, height: 20 }}
          source={require('../../assets/Info.png')}
        />
      </TouchableOpacity>

      {/* Popup Modal */}
      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          className="flex-1 items-center justify-center bg-black/50 px-4"
          activeOpacity={1}
          onPress={handleClose}
        >
          <TouchableOpacity
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
            style={{ maxWidth: Math.min(width * 0.85, 300) }}
            activeOpacity={1}
            onPress={() => {}} // 阻止點擊卡片時關閉
          >
            <Text className="text-sec-black mb-2 text-sm font-bold">{title}</Text>
            <View>{children}</View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default InfoPopup;
