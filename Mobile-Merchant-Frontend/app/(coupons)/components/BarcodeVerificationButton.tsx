import React from 'react';
import { XStack, Text } from 'tamagui';
import { TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors } from '@/constants/colors';

interface BarcodeVerificationButtonProps {
  onPress: () => void;
}

export function BarcodeVerificationButton({ onPress }: BarcodeVerificationButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.button}
    >
      <XStack
        alignItems="center"
        justifyContent="center"
        gap="$3"
        paddingVertical="$3"
        paddingHorizontal="$4"
      >
        <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
        <Text fontSize={16} fontWeight="600" color="#FFFFFF">
          條碼核銷
        </Text>
      </XStack>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4A4A4A',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
