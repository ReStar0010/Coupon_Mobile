import React from 'react';
import { View, Modal, Dimensions, Text, TouchableOpacity } from 'react-native';

interface MerchantDeletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
}

const { width } = Dimensions.get('window');

const MerchantDeletedModal: React.FC<MerchantDeletedModalProps> = ({
  isOpen,
  onClose,
  storeName,
}) => {
  return (
    <Modal visible={isOpen} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 32,
            width: '100%',
            maxWidth: Math.min(width * 0.85, 350),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          {/* Warning Icon */}
          <View
            style={{
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#FEF3C7',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 32 }}>!</Text>
            </View>
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#333',
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            商家已停止服務
          </Text>

          {/* Message */}
          <Text
            style={{
              fontSize: 15,
              color: '#666',
              textAlign: 'center',
              lineHeight: 24,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontWeight: '600', color: '#333' }}>{storeName}</Text> 已停止與 CouPro
            合作。
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: '#666',
              textAlign: 'center',
              lineHeight: 24,
              marginBottom: 32,
            }}
          >
            此商家的所有優惠券將不再提供服務，點擊確認後這些優惠券將從您的列表中移除。
          </Text>

          {/* Confirm Button */}
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
              elevation: 3,
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: '#333',
              }}
            >
              我知道了
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default MerchantDeletedModal;
