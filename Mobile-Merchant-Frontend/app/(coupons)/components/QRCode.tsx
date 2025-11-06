import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

interface QRCodeProps {
  value: string;
  size?: number;
}

// QR Code component - generates QR code using a URL-based service
// In production, you might want to use a library like react-native-qrcode-svg
// or generate QR codes on the backend
export function QRCode({ value, size = 200 }: QRCodeProps) {
  // Using a QR code API service to generate the QR code
  // Alternative: Use a library like react-native-qrcode-svg if installed
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <ExpoImage
        source={{ uri: qrCodeUrl }}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
});

