import React from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { colors } from '@/constants/colors';
import { StyleSheet, TouchableOpacity, Modal, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { QRCode } from './QRCode';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrValue: string;
}

export function QRCodeModal({ isOpen, onClose, qrValue }: QRCodeModalProps) {
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
            <Text fontSize={24} fontWeight="700" color={colors.textPrimary}>
              條碼核銷
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <View style={styles.closeButton}>
                <MaterialIcons name="close" size={20} color={colors.textPrimary} />
              </View>
            </TouchableOpacity>
          </XStack>

          {/* QR Code */}
          <YStack alignItems="center" justifyContent="center" marginBottom="$4">
            <QRCode value={qrValue} size={280} />
          </YStack>

          {/* Instruction Text */}
          <Text fontSize="$md" color={colors.textSecondary} textAlign="center" lineHeight={24}>
            請掃描此 QR Code 進行核銷
          </Text>
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
