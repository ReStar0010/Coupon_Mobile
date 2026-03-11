import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Text } from 'tamagui';
import { colors } from '@/constants/colors';

interface QRCodeProps {
  value: string;
  size?: number;
}

// QR Code component - generates QR code using a URL-based service
// In production, you might want to use a library like react-native-qrcode-svg
// or generate QR codes on the backend
export function QRCode({ value, size = 200 }: QRCodeProps) {
  // Ensure size is a valid number
  const qrSize: number = typeof size === 'number' && !isNaN(size) ? size : 200;

  // Validate that value is not empty
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    const errorContainerStyle = {
      width: Number(qrSize),
      height: Number(qrSize),
    };

    return (
      <View style={[styles.container, styles.errorContainer, errorContainerStyle]}>
        <Text color={colors.textSecondary} style={styles.errorText}>
          無法生成 QR Code
        </Text>
      </View>
    );
  }

  // Using a QR code API service to generate the QR code
  // Alternative: Use a library like react-native-qrcode-svg if installed
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(String(value))}`;

  // Create style objects with explicit number types to avoid symbol conversion issues
  const containerDynamicStyle = {
    width: Number(qrSize),
    height: Number(qrSize),
  };

  const imageDynamicStyle = {
    width: Number(qrSize),
    height: Number(qrSize),
  };

  return (
    <View style={[styles.container, containerDynamicStyle]}>
      <ExpoImage source={{ uri: qrCodeUrl }} style={imageDynamicStyle} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  errorContainer: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    textAlign: 'center',
  },
});
