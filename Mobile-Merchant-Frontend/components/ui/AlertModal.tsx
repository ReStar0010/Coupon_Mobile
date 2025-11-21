import React, { useEffect, useRef } from 'react';
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
  type?: 'success' | 'error';
  confirmText?: string;
  onConfirm?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'success',
  confirmText = '確定',
  onConfirm,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;

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
        const hideTimer = setTimeout(() => {
          hideModal(true); // Pass true to call onConfirm after closing
        }, 800);

        return () => clearTimeout(hideTimer);
      }
    } else {
      hideModal();
    }
  }, [isOpen, type]);

  const hideModal = (shouldCallOnConfirm = false) => {
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
  };

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
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.overlay, { paddingBottom: SCREEN_HEIGHT * 0.2 }]}
        activeOpacity={1}
        onPress={(type === 'success' || type === 'error') ? undefined : onClose}
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
            onPress={(type === 'success' || type === 'error') ? undefined : (e) => e.stopPropagation()}
          >
          {(type === 'success' || type === 'error') ? (
            <YStack alignItems="center" justifyContent="center" minHeight={56}>
              <Text style={[getStatusTextStyle(), styles.statusMessageText]}>
                {message}
              </Text>
            </YStack>
          ) : (
            <YStack gap={12} alignItems="center" width="100%">
              {/* Title */}
              <Text style={styles.title}>
                {title}
              </Text>

              {/* Message */}
              <Text style={styles.message}>
                {message}
              </Text>

              {/* Confirm Button */}
              <XStack width="100%" marginTop={8}>
                <Button
                  variant="primary"
                  fullWidth
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

