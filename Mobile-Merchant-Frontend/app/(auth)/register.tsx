import React, { useState } from 'react';
import { YStack, Text, XStack } from 'tamagui';
import { useRouter } from 'expo-router';
import { Input, Button, AlertModal } from '@/components/ui';
import { colors } from '@/constants/colors';
import { RegisterFormData } from '@/types';

export default function RegisterScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleEmailChange = (text: string) => {
    setFormData((prev) => ({ ...prev, email: text }));
  };

  const handlePasswordChange = (text: string) => {
    setFormData((prev) => ({ ...prev, password: text }));
  };

  const handleRegister = async () => {
    if (!formData.email || !formData.password) {
      setErrorMessage('請輸入 Email 和密碼');
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

    // Password validation
    if (formData.password.length < 6) {
      setErrorMessage('密碼長度至少需要 6 個字元');
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement actual register API call
      console.log('Register attempt:', formData);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Simulate success
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Register error:', error);
      setErrorMessage(error?.message || '註冊失敗，請稍後再試');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    router.back();
  };

  const handleLoginPress = () => {
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
          註冊
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

      {/* Password Input */}
      <Input
        placeholder="輸入密碼"
        value={formData.password}
        onChangeText={handlePasswordChange}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        editable={!isLoading}
        width="100%"
      />

      {/* Register Button */}
      <Button
        variant="primary"
        fullWidth
        onPress={handleRegister}
        disabled={isLoading}
        opacity={isLoading ? 0.6 : 1}
      >
        註冊
      </Button>

      {/* Login Link */}
      <XStack gap={10} justifyContent="center" alignItems="center" width="100%">
        <Text fontSize="$sm" color={colors.textPrimary} textAlign="center">
          已經有帳號了嗎 ?{' '}
          <Text
            fontSize="$sm"
            color={colors.primary}
            onPress={handleLoginPress}
            style={{ textDecorationLine: 'underline' }}
          >
            登入
          </Text>
        </Text>
      </XStack>

      {/* Success Modal */}
      <AlertModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="註冊成功"
        message="您的帳號已成功註冊！"
        type="success"
        confirmText="確定"
        onConfirm={handleSuccessConfirm}
      />

      {/* Error Modal */}
      <AlertModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="註冊失敗"
        message={errorMessage}
        type="error"
        confirmText="確定"
      />
    </YStack>
  );
}

