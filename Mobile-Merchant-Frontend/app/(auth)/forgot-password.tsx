import React, { useState } from 'react';
import { YStack, Text, XStack } from 'tamagui';
import { useRouter } from 'expo-router';
import { Input, Button, AlertModal } from '@/components/ui';
import { colors } from '@/constants/colors';
import { ForgotPasswordFormData } from '@/types';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<ForgotPasswordFormData>({
    email: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleEmailChange = (text: string) => {
    setFormData((prev) => ({ ...prev, email: text }));
  };

  const handleSendResetEmail = async () => {
    if (!formData.email) {
      setErrorMessage('請輸入 Email');
      setShowErrorModal(true);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErrorMessage('請輸入有效的 Email 格式');
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement actual forgot password API call
      console.log('Send reset email attempt:', formData);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Simulate success
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Send reset email error:', error);
      setErrorMessage(error?.message || '發送失敗，請稍後再試');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    router.back();
  };

  const handleBackToLogin = () => {
    router.back();
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

      {/* Empty space at bottom (10px height as per design) */}
      <XStack height={10} width="100%" />

      {/* Success Modal */}
      <AlertModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="發送成功"
        message="重設密碼信件已發送至您的 Email，請查收。"
        type="success"
        confirmText="確定"
        onConfirm={handleSuccessConfirm}
      />

      {/* Error Modal */}
      <AlertModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="發送失敗"
        message={errorMessage}
        type="error"
        confirmText="確定"
      />
    </YStack>
  );
}

