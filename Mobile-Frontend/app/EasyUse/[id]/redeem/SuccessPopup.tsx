import React from 'react';
import { View, Modal, Dimensions, Text, TouchableOpacity } from 'react-native';

interface SuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  couponDetail?: string;
  titleType?: string;
  couponName?: string;
  discountValue?: number | string;
  redeemedAt?: string;
  redemptionId?: number;
}

const { width } = Dimensions.get('window');

const SuccessPopup: React.FC<SuccessPopupProps> = ({
  isOpen,
  onClose,
  storeName = '店家名稱',
  couponDetail = '優惠詳情',
  titleType = '核銷成功',
  couponName,
  discountValue,
  redeemedAt,
  redemptionId,
}) => {
  // Format timestamp as YYYY/MM/DD HH:MM
  const formatTimestamp = (isoString?: string) => {
    if (!isoString) {
      // Fallback to current date if no timestamp provided
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    }
    try {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    } catch {
      return isoString;
    }
  };

  // Format discount value
  const formatDiscountValue = (value?: number | string) => {
    if (value === undefined || value === null) return '—';
    if (typeof value === 'number') {
      if (value === 0) return '免費';
      return `NT$${value.toLocaleString()}`;
    }
    return String(value);
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
            marginBottom: 24
          }}>
            {titleType}
          </Text>

          {/* Coupon Name - Prominent */}
          {couponName && (
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#333',
              textAlign: 'center',
              marginBottom: 24
            }} numberOfLines={2}>
              {couponName}
            </Text>
          )}

          {/* Content */}
          <View style={{ marginBottom: 40 }}>
            {/* Discount Value Row */}
            {discountValue !== undefined && (
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
                  優惠內容
                </Text>
                <Text style={{
                  fontSize: 16,
                  color: '#333',
                  fontWeight: '600',
                  maxWidth: 180,
                  textAlign: 'right'
                }} numberOfLines={2}>
                  {formatDiscountValue(discountValue)}
                </Text>
              </View>
            )}

            {/* Redemption Timestamp Row */}
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
                核銷時間
              </Text>
              <Text style={{
                fontSize: 16,
                color: '#333',
                fontWeight: '600'
              }}>
                {formatTimestamp(redeemedAt)}
              </Text>
            </View>

            {/* Store Name Row */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: redemptionId ? 20 : 0
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

            {/* Transaction ID Row - Small font */}
            {redemptionId && (
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Text style={{
                  fontSize: 12,
                  color: '#999',
                  fontWeight: '400'
                }}>
                  交易編號
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#999',
                  fontWeight: '400'
                }}>
                  #{redemptionId}
                </Text>
              </View>
            )}
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
