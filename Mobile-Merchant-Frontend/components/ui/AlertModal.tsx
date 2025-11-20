import React from 'react';
import { Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { YStack, Text, XStack } from 'tamagui';
import { colors } from '@/constants/colors';
import { Button } from './Button';

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
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.content}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <YStack gap={12} alignItems="center" width="100%">
            {/* Title */}
            <Text
              style={styles.title}
            >
              {title}
            </Text>

            {/* Message */}
            <Text
              style={styles.message}
            >
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
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: colors.white,
    borderRadius: 9,
    padding: 20,
    width: '85%',
    maxWidth: 400,
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
});

