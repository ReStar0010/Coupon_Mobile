import React from 'react';
import { XStack, Text } from 'tamagui';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface BarcodeVerificationButtonProps {
  onPress: () => void;
  isLoading?: boolean;
}

export function BarcodeVerificationButton({
  onPress,
  isLoading = false,
}: BarcodeVerificationButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.button, isLoading && styles.buttonDisabled]}
      disabled={isLoading}
    >
      <XStack
        alignItems="center"
        justifyContent="center"
        gap="$3"
        paddingVertical="$3"
        paddingHorizontal="$4"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
        )}
        <Text fontSize={16} fontWeight="600" color="#FFFFFF">
          {isLoading ? '生成中...' : '條碼核銷'}
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
  buttonDisabled: {
    opacity: 0.6,
  },
});
