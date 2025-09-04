import React from 'react';
import { View, Modal, Dimensions, Text, TouchableOpacity } from 'react-native';

interface SuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  couponDetail?: string;
  titleType?: string;
}

const { width } = Dimensions.get('window');

const SuccessPopup: React.FC<SuccessPopupProps> = ({
  isOpen,
  onClose,
  storeName = '店家名稱',
  couponDetail = '優惠詳情',
  titleType = '核銷成功',
}) => {
  // Format current date as YYYY/MM/DD
  const getCurrentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  return (
    <Modal visible={isOpen} transparent={true} animationType="fade" onRequestClose={onClose}>
      {/* Modal 遮罩層 */}
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20
      }}>
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 20,
          padding: 32,
          width: '100%',
          maxWidth: Math.min(width * 0.85, 350),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8
        }}>
          {/* Title */}
          <Text style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#333',
            textAlign: 'center',
            marginBottom: 32
          }}>
            {titleType}
          </Text>

          {/* Content */}
          <View style={{ marginBottom: 40 }}>
            {/* Usage Date Row */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <Text style={{
                fontSize: 16,
                color: '#999',
                fontWeight: '500'
              }}>
                使用日期
              </Text>
              <Text style={{
                fontSize: 16,
                color: '#333',
                fontWeight: '600'
              }}>
                {getCurrentDate()}
              </Text>
            </View>

            {/* Store Name Row */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Text style={{
                fontSize: 16,
                color: '#999',
                fontWeight: '500'
              }}>
                商家名稱
              </Text>
              <Text style={{
                fontSize: 16,
                color: '#333',
                fontWeight: '600',
                maxWidth: 180,
                textAlign: 'right'
              }} numberOfLines={1}>
                {storeName}
              </Text>
            </View>
          </View>

          {/* Complete Button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: '#FFAD31',
              borderRadius: 16,
              paddingVertical: 16,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3
            }}
            activeOpacity={0.8}>
            <Text style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: '#333'
            }}>
              完成
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default SuccessPopup;
