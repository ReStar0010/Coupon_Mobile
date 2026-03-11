import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { YStack, Text, XStack } from 'tamagui';
import { colors } from '@/constants/colors';
import { Button } from './Button';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning';
  autoHideDurationMs?: number;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'success',
  autoHideDurationMs,
  confirmText = '確定',
  cancelText,
  onConfirm,
  onCancel,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;

  const hideModal = useCallback(
    (shouldCallOnConfirm = false) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 50,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
        // Call onConfirm after modal closes if it was auto-hide
        if (shouldCallOnConfirm && onConfirm) {
          onConfirm();
        }
      });
    },
    [fadeAnim, onClose, onConfirm, translateYAnim],
  );

  useEffect(() => {
    if (isOpen) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after 0.8 seconds for success/error types
      if (type === 'success' || type === 'error') {
        const durationMs = autoHideDurationMs ?? 1500;
        const hideTimer = setTimeout(() => {
          hideModal(true); // Pass true to call onConfirm after closing
        }, durationMs);

        return () => clearTimeout(hideTimer);
      }
    } else {
      hideModal();
    }
  }, [autoHideDurationMs, fadeAnim, hideModal, isOpen, translateYAnim, type]);

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      hideModal();
    }
  };

  const getStatusButtonStyle = () => {
    if (type === 'success') {
      return styles.successButton;
    } else if (type === 'error') {
      return styles.errorButton;
    } else if (type === 'warning') {
      return styles.warningButton;
    }
    return {};
  };

  const getStatusTextStyle = () => {
    if (type === 'success' || type === 'error') {
      return styles.statusText;
    }
    return {};
  };

  return (
    <Modal visible={isOpen} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.overlay, { paddingBottom: SCREEN_HEIGHT * 0.2 }]}
        activeOpacity={1}
        onPress={type === 'success' || type === 'error' ? undefined : onClose}
      >
        <Animated.View
          style={[
            styles.content,
            (type === 'success' || type === 'error') && styles.statusContent,
            getStatusButtonStyle(),
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={
              type === 'success' || type === 'error' ? undefined : (e) => e.stopPropagation()
            }
          >
            {type === 'success' || type === 'error' ? (
              <YStack style={{ alignItems: 'center', justifyContent: 'center', minHeight: 56 }}>
                <Text style={[getStatusTextStyle(), styles.statusMessageText]}>{message}</Text>
              </YStack>
            ) : (
              <YStack gap={12} style={{ alignItems: 'center' }} width="100%">
                {/* Title */}
                <Text style={styles.title}>{title}</Text>

                {/* Message */}
                <Text style={styles.message}>{message}</Text>

                {/* Confirm Button */}
                <XStack width="100%" style={{ marginTop: 8 }} gap={8}>
                  {!!cancelText && (
                    <Button variant="outline" flex={1} onPress={onCancel ?? onClose}>
                      {cancelText}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    flex={cancelText ? 1 : undefined}
                    fullWidth={!cancelText}
                    onPress={handleConfirm}
                  >
                    {confirmText}
                  </Button>
                </XStack>
              </YStack>
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: colors.white,
    borderRadius: 9,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  statusContent: {
    paddingHorizontal: 16,
    width: 'auto',
    minWidth: 134,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40, // Fully rounded (pill shape) - large radius for pill shape
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  successButton: {
    backgroundColor: '#4ADE80', // Green color for success (matching Mobile-Frontend)
  },
  errorButton: {
    backgroundColor: '#EF4444', // Red color for error (matching Mobile-Frontend)
  },
  warningButton: {
    backgroundColor: '#FFFFFF', // Orange color for warning
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusMessageText: {
    textAlign: 'center',
  },
});
