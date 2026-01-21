/**
 * EULA Modal Component
 * UGC Compliance (Apple Guideline 1.2) - User Story 3
 *
 * Displays EULA and content guidelines for merchant acceptance before first upload.
 * Features:
 * - Full EULA text with scroll-to-bottom detection
 * - Content guidelines section
 * - "I Agree" checkbox (enabled after scrolling to bottom)
 * - Accept/Cancel actions
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { acceptEULA, getEULAContent, EULAContent } from '../../services/eulaAPI';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface EULAModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EULAModal: React.FC<EULAModalProps> = ({ visible, onClose, onSuccess }) => {
  const [eulaContent, setEulaContent] = useState<EULAContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Load EULA content when modal opens
  React.useEffect(() => {
    if (visible && !eulaContent) {
      loadEULAContent();
    }
  }, [visible]);

  const loadEULAContent = async () => {
    setLoadingContent(true);
    setError(null);
    try {
      const content = await getEULAContent();
      setEulaContent(content);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.error || err?.message || '無法載入使用條款，請稍後再試';
      setError(errorMessage);
    } finally {
      setLoadingContent(false);
    }
  };

  // Detect scroll to bottom
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const paddingToBottom = 20; // Threshold for "bottom" detection
      const isAtBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

      if (isAtBottom && !hasScrolledToBottom) {
        setHasScrolledToBottom(true);
      }
    },
    [hasScrolledToBottom]
  );

  const handleAccept = async () => {
    if (!isAgreed || !eulaContent) {
      setError('請閱讀完整條款並勾選同意後繼續');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await acceptEULA({
        version: eulaContent.version,
        agreed: true,
      });

      // Success - onSuccess already handles closing the modal and resolving the promise
      resetForm();
      // Only call onSuccess, which will close the modal and resolve the promise correctly
      // Don't call onClose() as it would resolve the promise as false
      onSuccess();
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.error || err?.message || '接受條款失敗，請稍後再試';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setHasScrolledToBottom(false);
    setIsAgreed(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal 
      visible={visible} 
      transparent={true} 
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>使用者授權條款 (EULA)</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loadingContent ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>載入中...</Text>
            </View>
          ) : eulaContent ? (
            <View style={styles.contentWrapper}>
              {/* Scrollable EULA Content */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.contentScrollView}
                contentContainerStyle={styles.contentContainer}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.versionText}>版本: {eulaContent.version}</Text>
                <Text style={styles.dateText}>
                  最後更新: {new Date(eulaContent.last_updated).toLocaleDateString('zh-TW')}
                </Text>

                {/* EULA Content */}
                <Text style={styles.sectionTitle}>{eulaContent.title}</Text>
                <Text style={styles.bodyText}>{eulaContent.content}</Text>

                {/* Content Guidelines */}
                <Text style={styles.sectionTitle}>內容規範</Text>
                <Text style={styles.bodyText}>{eulaContent.content_guidelines}</Text>

                {/* Penalties */}
                <Text style={styles.sectionTitle}>違規處理</Text>
                <Text style={styles.bodyText}>{eulaContent.penalties}</Text>

                {/* Scroll indicator */}
                {!hasScrolledToBottom && (
                  <View style={styles.scrollIndicator}>
                    <Ionicons name="chevron-down" size={24} color="#007AFF" />
                    <Text style={styles.scrollIndicatorText}>請滾動至底部閱讀完整條款</Text>
                  </View>
                )}
              </ScrollView>

              {/* Checkbox and Actions */}
              <View style={styles.footer}>
                {/* Error Message */}
                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Checkbox */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setIsAgreed(!isAgreed)}
                  disabled={!hasScrolledToBottom}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isAgreed && styles.checkboxChecked,
                      !hasScrolledToBottom && styles.checkboxDisabled,
                    ]}
                  >
                    {isAgreed && <Ionicons name="checkmark" size={18} color="#fff" />}
                  </View>
                  <Text
                    style={[
                      styles.checkboxLabel,
                      !hasScrolledToBottom && styles.checkboxLabelDisabled,
                    ]}
                  >
                    我已閱讀並同意上述使用者授權條款及內容規範
                  </Text>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={handleClose}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>取消</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.acceptButton,
                      (!isAgreed || loading) && styles.acceptButtonDisabled,
                    ]}
                    onPress={handleAccept}
                    disabled={!isAgreed || loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.acceptButtonText}>接受並繼續</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error || '無法載入使用條款'}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadEULAContent}>
                <Text style={styles.retryButtonText}>重試</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    height: height * 0.85,
    maxHeight: height * 0.85,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden' as const,
    flexDirection: 'column' as const,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  contentWrapper: {
    flex: 1,
    minHeight: 0,
  },
  contentScrollView: {
    flex: 1,
    minHeight: 0, // Important for ScrollView in flex container
  },
  contentContainer: {
    padding: 16,
  },
  versionText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    marginBottom: 8,
  },
  scrollIndicator: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  scrollIndicatorText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkboxDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  checkboxLabelDisabled: {
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  acceptButton: {
    backgroundColor: '#007AFF',
  },
  acceptButtonDisabled: {
    backgroundColor: '#ccc',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
};

export default EULAModal;

