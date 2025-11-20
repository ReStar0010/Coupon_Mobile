import React, { useState } from 'react';
import { YStack, Text, XStack } from 'tamagui';
import { useRouter } from 'expo-router';
import { Input, Button } from '@/components/ui';
import { colors } from '@/constants/colors';
import { ForgotPasswordFormData } from '@/types';
import { StyleSheet, View } from 'react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<ForgotPasswordFormData>({
    email: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<'success' | 'error' | null>(null);

  const handleEmailChange = (text: string) => {
    setFormData((prev) => ({ ...prev, email: text }));
  };

  const handleSendResetEmail = async () => {
    if (!formData.email) {
      setStatusMessage('error');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatusMessage('error');
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    try {
      const { authAPI } = await import('@/utils/api');
      await authAPI.forgotPassword(formData.email);
      
      setStatusMessage('success');
    } catch (error: any) {
      console.error('Send reset email error:', error);
      setStatusMessage('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    // Use replace instead of back since we used replace to navigate here
    router.replace('/(auth)/login');
  };

  return (
    <YStack
      flex={1}
      backgroundColor={colors.background}
      paddingHorizontal="$5"
      paddingVertical="$8"
      justifyContent="center"
      alignItems="center"
      gap="$3"
    >
      {/* Title */}
      <XStack width="100%" justifyContent="center" alignItems="center" marginBottom="$2">
        <Text
          fontSize={34}
          fontWeight="800"
          color={colors.textPrimary}
          style={{ lineHeight: 42.5 }}
        >
          忘記密碼
        </Text>
      </XStack>

      {/* Email Input */}
      <Input
        placeholder="輸入 Email"
        value={formData.email}
        onChangeText={handleEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!isLoading}
        width="100%"
      />

      {/* Send Reset Email Button */}
      <Button
        variant="primary"
        fullWidth
        onPress={handleSendResetEmail}
        disabled={isLoading}
        opacity={isLoading ? 0.6 : 1}
      >
        寄送重設密碼信件
      </Button>

      {/* Back to Login Link */}
      <XStack gap={10} justifyContent="center" alignItems="center" width="100%">
        <Text fontSize="$sm" color={colors.textPrimary} textAlign="center">
          <Text
            fontSize="$sm"
            color={colors.primary}
            onPress={handleBackToLogin}
            style={{ textDecorationLine: 'underline' }}
          >
            返回登入
          </Text>
        </Text>
      </XStack>

      {/* Status Message Button */}
      {statusMessage && (
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusButton,
              statusMessage === 'success' ? styles.successButton : styles.errorButton,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                statusMessage === 'success' ? styles.successText : styles.errorText,
              ]}
            >
              {statusMessage === 'success' ? '信件寄送成功' : '信件寄送失敗'}
            </Text>
          </View>
        </View>
      )}
    </YStack>
  );
}

const styles = StyleSheet.create({
  statusContainer: {
    width: '100%',
    marginTop: 10,
  },
  statusButton: {
    width: '100%',
    height: 54,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#4CAF50', // Green color for success
  },
  errorButton: {
    backgroundColor: '#FFB6C1', // Pink color for error
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  successText: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#FFFFFF',
  },
});

