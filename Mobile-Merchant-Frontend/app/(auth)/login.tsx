import React, { useState } from 'react';
import { YStack, Text, XStack } from 'tamagui';
import { useRouter } from 'expo-router';
import { Input, Button, AlertModal } from '@/components/ui';
import { colors } from '@/constants/colors';
import { LoginFormData } from '@/types';

export default function LoginScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({
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

  const handleLogin = async () => {
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

    setIsLoading(true);
    try {
      // TODO: Implement actual login API call
      console.log('Login attempt:', formData);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Simulate success - in real app, this would be based on API response
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Login error:', error);
      setErrorMessage(error?.message || '登入失敗，請檢查您的帳號密碼');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    // router.replace('/(tabs)');
  };

  const handleRegisterPress = () => {
    router.push('/(auth)/register');
  };

  const handleForgotPasswordPress = () => {
    router.push('/(auth)/forgot-password');
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
          登入
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

      {/* Login Button */}
      <Button
        variant="primary"
        fullWidth
        onPress={handleLogin}
        disabled={isLoading}
        opacity={isLoading ? 0.6 : 1}
      >
        登入
      </Button>

      {/* Register Link */}
      <XStack gap={10} justifyContent="center" alignItems="center" width="100%">
        <Text fontSize="$sm" color={colors.textPrimary} textAlign="center">
          還沒有帳號嗎 ?{' '}
          <Text
            fontSize="$sm"
            color={colors.primary}
            onPress={handleRegisterPress}
            style={{ textDecorationLine: 'underline' }}
          >
            註冊
          </Text>
        </Text>
      </XStack>

      {/* Forgot Password Link */}
      <XStack gap={10} justifyContent="center" alignItems="center" width="100%">
        <Text fontSize="$sm" color={colors.textPrimary} textAlign="center">
          <Text fontSize="$sm" color={colors.textPrimary}>
            忘記密碼 ?{' '}
          </Text>
          <Text
            fontSize="$sm"
            color={colors.primary}
            onPress={handleForgotPasswordPress}
            style={{ textDecorationLine: 'underline' }}
          >
            重設
          </Text>
        </Text>
      </XStack>

      {/* Success Modal */}
      <AlertModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="登入成功"
        message="歡迎回來！"
        type="success"
        confirmText="確定"
        onConfirm={handleSuccessConfirm}
      />

      {/* Error Modal */}
      <AlertModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="登入失敗"
        message={errorMessage}
        type="error"
        confirmText="確定"
      />
    </YStack>
  );
}

