import React from 'react';
import { View, Modal, Dimensions } from 'react-native';
import { SuccessIcon } from './SuccessIcon'; // 確認路徑正確
import { ConfirmationCard } from './ConfirmationCard'; // 確認路徑正確

interface SuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  couponDetail?: string;
  titleType?: string; // 標題類型
}

const { width } = Dimensions.get('window');

const SuccessPopup: React.FC<SuccessPopupProps> = ({
  isOpen,
  onClose,
  storeName = '店家名稱', // 提供預設值
  couponDetail = '優惠詳情', // 提供預設值
  titleType = '核銷成功',
}) => {
  return (
    <Modal visible={isOpen} transparent={true} animationType="fade" onRequestClose={onClose}>
      {/* Modal 遮罩層 */}
      <View className="flex-1 items-center justify-center bg-black/50 px-4">
        <View
          className="relative w-full max-w-sm"
          style={{ maxWidth: Math.min(width * 0.85, 400) }}>
          {/* Success Icon - 絕對定位在上方 */}
          <View
            className="absolute left-1/2 z-10"
            style={{
              transform: [{ translateX: -44.5 }], // 半個圖標寬度 (89/2)
              top: -44.5, // 半個圖標高度，讓它覆蓋在卡片上方
            }}>
            <SuccessIcon />
          </View>

          {/* Confirmation Card */}
          <ConfirmationCard
            title={titleType} // 標題類型
            message={[storeName, `「 ${couponDetail} 」`]} // 動態顯示店家和優惠內容
            onConfirm={onClose} // OK 按鈕觸發關閉彈窗
          />
        </View>
      </View>
    </Modal>
  );
};

export default SuccessPopup;
