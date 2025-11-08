import React from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { colors } from '@/constants/colors';
import { StyleSheet, TouchableOpacity, Modal, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Button } from '@/components/ui';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteModal({ isOpen, onClose, onConfirm }: DeleteModalProps) {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <XStack alignItems="center" justifyContent="space-between" marginBottom="$4">
            <Text fontSize={30} fontWeight="700" color={colors.textPrimary}>
              刪除
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <View style={styles.closeButton}>
                <MaterialIcons name="close" size={20} color={colors.textPrimary} />
              </View>
            </TouchableOpacity>
          </XStack>

          {/* Warning Message */}
          <Text fontSize="$md" color={colors.error} marginBottom="$6" lineHeight={24}>
            注意：一旦將此優惠刪除，相關資料與數據將消失，無法復原。
          </Text>

          {/* Confirm Button */}
          <Button variant="primary" fullWidth onPress={onConfirm}>
            確認
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

