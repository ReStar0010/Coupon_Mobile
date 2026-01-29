import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { Header } from '../components/Header';
import { QRCode } from '../components/QRCode';
import { merchantAPI } from '@/utils/api';

export default function QRCodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

  // Generate QR code session on mount
  useEffect(() => {
    if (id) {
      generateQRSession();
    }

    // Cleanup: invalidate session on unmount
    return () => {
      if (sessionId !== null) {
        invalidateSession(sessionId);
      }
    };
  }, [id]);

  // Poll remaining quantity only while this QR code screen is open and QR is displayed.
  // Does not run on other screens (coupon list/detail); stops on unmount when merchant leaves.
  const POLL_INTERVAL_MS = 3000;
  useEffect(() => {
    if (!id || !qrCodeData || !sessionId) return;

    const pollRemaining = async () => {
      try {
        const template = await merchantAPI.getTemplate(parseInt(id));
        const remaining = (template as { remaining_quantity?: number }).remaining_quantity;
        if (typeof remaining === 'number' && remaining <= 0) {
          await invalidateSession(sessionId);
          router.replace('/(coupons)/');
        }
      } catch (err) {
        // Ignore poll errors (e.g. network); will retry next interval
      }
    };

    const intervalId = setInterval(pollRemaining, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [id, qrCodeData, sessionId]);

  const generateQRSession = async () => {
    if (!id) {
      setError('無效的優惠券 ID');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await merchantAPI.generateQRSession(parseInt(id));
      setSessionId(result.session_id);
      setQrCodeData(result.qr_code_data);
    } catch (err: any) {
      console.error('QR code generation error:', err);
      setError(err?.message || '生成 QR Code 失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  const invalidateSession = async (sessionIdToInvalidate: number) => {
    try {
      await merchantAPI.invalidateQRSession(sessionIdToInvalidate);
    } catch (err) {
      console.error('Session invalidation error:', err);
      // Don't show error to user, just log it
    }
  };

  const handleClose = () => {
    // Invalidate session before closing
    if (sessionId !== null) {
      invalidateSession(sessionId);
    }
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.white}>
        <Header onLogoPress={() => router.push('/(coupons)/')} />
        
        {/* Main Content */}
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$4" gap="$6">
          {isLoading ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text fontSize="$md" color={colors.textSecondary}>
                正在生成 QR Code...
              </Text>
            </>
          ) : error ? (
            <>
              <Text fontSize="$md" color={colors.error} textAlign="center">
                {error}
              </Text>
              <TouchableOpacity
                onPress={generateQRSession}
                style={styles.retryButton}
              >
                <Text color={colors.primary} fontSize="$md" fontWeight="600">
                  重試
                </Text>
              </TouchableOpacity>
            </>
          ) : qrCodeData ? (
            <>
              <Text fontSize="$xl" fontWeight="700" color={colors.textPrimary} marginBottom="$2">
                掃描 QR Code 領取優惠券
              </Text>
              <QRCode value={qrCodeData} size={280} />
              <Text fontSize="$sm" color={colors.textSecondary} textAlign="center" marginTop="$4">
                請保持此畫面開啟，關閉後 QR Code 將失效
              </Text>
            </>
          ) : null}
        </YStack>

        {/* Close Button */}
        <YStack padding="$4" paddingBottom="$6">
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
          >
            <Text color={colors.white} fontSize="$md" fontWeight="600">
              關閉
            </Text>
          </TouchableOpacity>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  closeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
