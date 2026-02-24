import React, { useState } from 'react';
import { YStack, Text, XStack } from 'tamagui';
import { useRouter } from 'expo-router';
import { Input, Button, AlertModal } from '@/components/ui';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
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
  const [errorModalTitle, setErrorModalTitle] = useState('登入失敗');
  const [errorModalType, setErrorModalType] = useState<'success' | 'error'>('error');
  const [errorModalAutoHideDurationMs, setErrorModalAutoHideDurationMs] = useState<
    number | undefined
  >(undefined);
  const [showUnverifiedModal, setShowUnverifiedModal] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const handleEmailChange = (text: string) => {
    setFormData((prev) => ({ ...prev, email: text }));
  };

  const handlePasswordChange = (text: string) => {
    setFormData((prev) => ({ ...prev, password: text }));
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      setErrorModalTitle('登入失敗');
      setErrorModalType('error');
      setErrorModalAutoHideDurationMs(undefined);
      setErrorMessage('請輸入 Email 和密碼');
      setShowErrorModal(true);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErrorModalTitle('登入失敗');
      setErrorModalType('error');
      setErrorModalAutoHideDurationMs(undefined);
      setErrorMessage('請輸入有效的 Email 格式');
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);
    try {
      const { authAPI } = await import('@/utils/api');
      const response = await authAPI.login(formData.email, formData.password);
      console.log('[Login] Login successful:', response);

      // Verify user is a merchant after login
      try {
        const userInfo = await authAPI.getUserInfo();
        console.log('[Login] User info:', userInfo);

        // Check if user is a merchant
        if (!userInfo.is_merchant) {
          // User is not a merchant, clear tokens and show error
          const { clearTokens } = await import('@/utils/api');
          await clearTokens();
          await checkAuth();
          setErrorMessage('此帳號不是商家帳號，無法使用商家應用程式。');
          setErrorModalTitle('登入失敗');
          setErrorModalType('error');
          setErrorModalAutoHideDurationMs(undefined);
          setShowErrorModal(true);
          return;
        }
      } catch (userInfoError: any) {
        console.error('[Login] Failed to verify merchant status:', userInfoError);
        // If we can't verify merchant status, still allow login but log warning
        // The merchant endpoints will catch this and handle appropriately
      }

      // Immediately refresh auth state after successful login
      await checkAuth();
      console.log('[Login] Auth state refreshed');

      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[Login] Login error:', error);

      // Check if error is wrong client type (user account tried to log in on merchant app)
      if (error?.error === 'wrong_client_type') {
        setErrorMessage('此帳號為一般使用者，請使用使用者端 App 登入');
        setErrorModalTitle('登入失敗');
        setErrorModalType('error');
        setErrorModalAutoHideDurationMs(undefined);
        setShowErrorModal(true);
        return;
      }

      // Check if error is email not verified
      // Check error.error field first (from parseResponse special handling)
      // Then check message for backward compatibility
      if (
        error?.error === 'email_not_verified' ||
        error?.message?.includes('email_not_verified') ||
        error?.message?.includes('請先驗證您的電子郵件') ||
        error?.message?.includes('電子郵件')
      ) {
        // Use email from error object if available, otherwise use form email
        setUnverifiedEmail(error?.email || formData.email);
        setShowUnverifiedModal(true);
        return;
      }

      // Extract error message, handling both Error objects and API response errors
      let errorMsg = '登入失敗，請檢查您的帳號密碼';
      if (error?.message) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      }
      setErrorMessage(errorMsg);
      setErrorModalTitle('登入失敗');
      setErrorModalType('error');
      setErrorModalAutoHideDurationMs(undefined);
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

  const handleResendVerification = async () => {
    setIsLoading(true);
    try {
      const { authAPI } = await import('@/utils/api');
      await authAPI.resendVerification(unverifiedEmail);
      setShowUnverifiedModal(false);
      setErrorMessage('驗證郵件已重新發送，請檢查您的信箱');
      setErrorModalTitle('已寄出驗證郵件');
      setErrorModalType('success');
      setErrorModalAutoHideDurationMs(2000);
      setShowErrorModal(true);
    } catch (error: any) {
      console.error('[Login] Resend verification error:', error);
      let errorMsg = '發送驗證郵件失敗，請稍後再試';

      // Check for rate limit error
      if (error?.message?.includes('等待') || error?.message?.includes('秒')) {
        errorMsg = error.message;
      }

      setShowUnverifiedModal(false);
      setErrorMessage(errorMsg);
      setErrorModalTitle('發送失敗');
      setErrorModalType('error');
      setErrorModalAutoHideDurationMs(undefined);
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DismissKeyboardView>
      <YStack
        flex={1}
        style={{
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          paddingVertical: 32,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        gap="$3"
      >
        {/* Title */}
        <XStack
          width="100%"
          style={{ justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}
        >
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
        <XStack gap={10} style={{ justifyContent: 'center', alignItems: 'center' }} width="100%">
          <Text fontSize="$sm" color={colors.textPrimary} style={{ textAlign: 'center' }}>
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
        <XStack gap={10} style={{ justifyContent: 'center', alignItems: 'center' }} width="100%">
          <Text fontSize="$sm" color={colors.textPrimary} style={{ textAlign: 'center' }}>
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
          title={errorModalTitle}
          message={errorMessage}
          type={errorModalType}
          autoHideDurationMs={errorModalAutoHideDurationMs}
          confirmText="確定"
        />

        {/* Unverified Email Modal */}
        <AlertModal
          isOpen={showUnverifiedModal}
          onClose={() => setShowUnverifiedModal(false)}
          title="電子郵件未驗證"
          message="您的電子郵件尚未驗證，請先完成驗證才能登入。是否要重新發送驗證郵件？"
          type="warning"
          confirmText="重新發送"
          cancelText="取消"
          onConfirm={handleResendVerification}
          onCancel={() => setShowUnverifiedModal(false)}
        />
      </YStack>
    </DismissKeyboardView>
  );
}
