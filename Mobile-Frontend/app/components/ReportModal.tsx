/**
 * Report Modal Component
 * UGC Compliance (Apple Guideline 1.2) - User Story 1
 *
 * Allows users to report inappropriate content with:
 * - Reason selection (radio buttons)
 * - Optional details text input
 * - Submit and cancel actions
 */

import React, { useState } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import {
  submitReport,
  ReportReason,
  ReportContentType,
  REPORT_REASONS,
} from '../services/contentReportAPI';
import { useToast } from './ToastContext';

const { width } = Dimensions.get('window');

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: ReportContentType;
  contentId: number;
  contentName?: string;
  onSuccess?: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  contentType,
  contentId,
  contentName,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const resetForm = () => {
    setSelectedReason(null);
    setDetails('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('請選擇檢舉原因');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await submitReport(contentType, contentId, {
        reason: selectedReason,
        details: details.trim() || undefined,
      });

      showToast('檢舉已提交，感謝您的回報', 'success');
      resetForm();
      onClose();
      onSuccess?.();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || '提交失敗，請稍後再試';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const contentTypeLabel = contentType === 'coupon' ? '優惠券' : '商店';

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
              width: '100%',
              maxWidth: Math.min(width * 0.9, 400),
              maxHeight: '80%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <ScrollView
              contentContainerStyle={{ padding: 24 }}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
            >
              {/* Header */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#333',
                    textAlign: 'center',
                  }}
                >
                  檢舉{contentTypeLabel}
                </Text>
                {contentName && (
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#666',
                      textAlign: 'center',
                      marginTop: 8,
                    }}
                    numberOfLines={1}
                  >
                    {contentName}
                  </Text>
                )}
              </View>

              {/* Reason Selection */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#333',
                    marginBottom: 12,
                  }}
                >
                  檢舉原因 *
                </Text>
                {REPORT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    onPress={() => setSelectedReason(reason.value)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      backgroundColor: selectedReason === reason.value ? '#FFF8E7' : '#F5F5F5',
                      borderRadius: 12,
                      marginBottom: 8,
                      borderWidth: 2,
                      borderColor: selectedReason === reason.value ? '#FFAD31' : 'transparent',
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Radio Button */}
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: selectedReason === reason.value ? '#FFAD31' : '#CCC',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                      }}
                    >
                      {selectedReason === reason.value && (
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: '#FFAD31',
                          }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        color: '#333',
                        fontWeight: selectedReason === reason.value ? '600' : '400',
                      }}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Details Input */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#333',
                    marginBottom: 12,
                  }}
                >
                  補充說明（選填）
                </Text>
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="請描述具體問題..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  style={{
                    backgroundColor: '#F5F5F5',
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 15,
                    color: '#333',
                    minHeight: 100,
                    textAlignVertical: 'top',
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: '#999',
                    textAlign: 'right',
                    marginTop: 4,
                  }}
                >
                  {details.length}/500
                </Text>
              </View>

              {/* Error Message */}
              {error && (
                <View
                  style={{
                    backgroundColor: '#FEE2E2',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#DC2626' }}>{error}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={loading}
                  style={{
                    flex: 1,
                    backgroundColor: '#E5E5E5',
                    borderRadius: 12,
                    paddingVertical: 14,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#666',
                    }}
                  >
                    取消
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading || !selectedReason}
                  style={{
                    flex: 1,
                    backgroundColor: loading || !selectedReason ? '#FFD699' : '#FFAD31',
                    borderRadius: 12,
                    paddingVertical: 14,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator color="#333" size="small" />
                  ) : (
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#333',
                      }}
                    >
                      提交檢舉
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default ReportModal;
