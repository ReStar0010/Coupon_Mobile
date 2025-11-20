import React, { useState } from 'react';
import { YStack, Text, XStack } from 'tamagui';
import { useRouter } from 'expo-router';
import { Input, Button, AlertModal } from '@/components/ui';
import { colors } from '@/constants/colors';
import { LoginFormData } from '@/types';
import { useAuth } from '@/app/components/providers/AuthProvider';

export default function LoginScreen() {
  const router = useRouter();
  const { checkAuth } = useAuth();
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
      const { authAPI } = await import('@/utils/api');
      const response = await authAPI.login(formData.email, formData.password);
      console.log('[Login] Login successful:', response);
      
      // Immediately refresh auth state after successful login
      await checkAuth();
      console.log('[Login] Auth state refreshed');
      
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[Login] Login error:', error);
      // Extract error message, handling both Error objects and API response errors
      let errorMsg = '登入失敗，請檢查您的帳號密碼';
      if (error?.message) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      }
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessConfirm = async () => {
    setShowSuccessModal(false);
    // Refresh auth state in AuthProvider
    try {
      await checkAuth();
      console.log('[Login] Auth state refreshed after login');
    } catch (error) {
      console.error('[Login] Failed to refresh auth state:', error);
    }
    // Navigate to coupons page
    router.replace('/(coupons)/');
  };

  const handleRegisterPress = () => {
    console.log('[Login] Navigating to register page');
    // Use replace instead of push to avoid back navigation issues
    router.replace('/(auth)/register');
  };

  const handleForgotPasswordPress = () => {
    console.log('[Login] Navigating to forgot password page');
    // Use replace instead of push to avoid back navigation issues
    router.replace('/(auth)/forgot-password');
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

