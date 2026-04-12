import React from 'react';
import { FormHeader } from '@/app/components/forms/FormHeader';
import { FormInput } from '@/app/components/forms/FormInput';
import { PasswordInput } from '@/app/components/forms/PasswordInput';
import { FormButton } from '@/app/components/forms/FormButton';
import { LinkText } from '@/app/components/forms/LinkText';
import { YStack } from 'tamagui';
import { Text } from 'tamagui';
import { maskPhoneNumber } from '@/app/services/phoneOtpAPI';

// Shared color constants
export const AUTH_COLORS = {
  background: '#f5f5f5',
  primary: '#FFAD31',
  primaryPressed: '#FF9500',
  text: '#374151',
  textSecondary: '#666666',
  border: '#e0e0e0',
  inputBackground: '#f5f5f5',
  white: '#FFFFFF',
} as const;

export type AuthStep = 'phone' | 'loginPassword' | 'registerPassword';

interface LoginFormContainerProps {
  email: string;
  setEmail: (email: string) => void;
  phoneNumber: string;
  setPhoneNumber: (phoneNumber: string) => void;
  password: string;
  setPassword: (password: string) => void;
  handleLogin: () => void;
  handleRegister: () => void;
  handleForgotPassword: () => void;
  onForgotPasswordPress?: () => void;
  onForgotPasswordBack?: () => void;
  mode?: 'login' | 'register' | 'forgotPassword';
  loginMode?: 'phone' | 'email';
  setLoginMode?: (mode: 'phone' | 'email') => void;
  /** Phone-first flow step (ignored when loginMode is email or mode is forgotPassword). */
  authStep?: AuthStep;
  onPhoneContinue?: () => void;
  isCheckingPhone?: boolean;
  onChangePhoneNumber?: () => void;
  onSwitchToPhoneLogin?: () => void;
}

export const LoginFormContainer: React.FC<LoginFormContainerProps> = ({
  email,
  setEmail,
  phoneNumber,
  setPhoneNumber,
  password,
  setPassword,
  handleLogin,
  handleRegister,
  handleForgotPassword,
  onForgotPasswordPress,
  onForgotPasswordBack,
  mode,
  loginMode = 'phone',
  setLoginMode,
  authStep = 'phone',
  onPhoneContinue,
  isCheckingPhone = false,
  onChangePhoneNumber,
  onSwitchToPhoneLogin,
}) => {
  const showEmailLogin = mode === 'login' && loginMode === 'email';
  const showForgotPassword = mode === 'forgotPassword';

  const getTitle = (): string => {
    if (showForgotPassword) {
      return '忘記密碼';
    }
    if (showEmailLogin) {
      return '登入';
    }
    if (authStep === 'phone') {
      return '手機號碼';
    }
    if (authStep === 'loginPassword') {
      return '登入';
    }
    if (authStep === 'registerPassword') {
      return '註冊';
    }
    switch (mode) {
      case 'login':
        return '登入';
      case 'register':
        return '註冊';
      default:
        return '登入';
    }
  };

  const getButtonTitle = (): string => {
    if (showForgotPassword) {
      return '發送驗證碼';
    }
    if (showEmailLogin) {
      return '登入';
    }
    if (authStep === 'phone') {
      return isCheckingPhone ? '查詢中…' : '繼續';
    }
    if (authStep === 'loginPassword') {
      return '登入';
    }
    if (authStep === 'registerPassword') {
      return '註冊';
    }
    switch (mode) {
      case 'login':
        return '登入';
      case 'register':
        return '註冊';
      default:
        return '登入';
    }
  };

  const getButtonHandler = () => {
    if (showForgotPassword) {
      return handleForgotPassword;
    }
    if (showEmailLogin) {
      return handleLogin;
    }
    if (authStep === 'phone') {
      return onPhoneContinue ?? (() => {});
    }
    if (authStep === 'loginPassword') {
      return handleLogin;
    }
    if (authStep === 'registerPassword') {
      return handleRegister;
    }
    switch (mode) {
      case 'login':
        return handleLogin;
      case 'register':
        return handleRegister;
      default:
        return handleLogin;
    }
  };

  const primaryDisabled = authStep === 'phone' && !!isCheckingPhone;

  return (
    <YStack bg={AUTH_COLORS.background} px="$5" py="$6" gap="$3">
      <FormHeader title={getTitle()} />

      {/* Email login */}
      {showEmailLogin && (
        <>
          <FormInput
            placeholder="輸入 Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <PasswordInput
            placeholder="輸入密碼"
            value={password}
            onChangeText={setPassword}
          />
        </>
      )}

      {/* Forgot password — phone already in parent state */}
      {showForgotPassword && (
        <Text fontSize={14} color={AUTH_COLORS.textSecondary}>
          我們會傳送驗證碼至 {maskPhoneNumber(phoneNumber)}
        </Text>
      )}

      {/* Phone-first: collect phone */}
      {!showEmailLogin && !showForgotPassword && authStep === 'phone' && (
        <>
          <FormInput
            placeholder="輸入手機號碼"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        </>
      )}

      {/* Phone-first: login with password */}
      {!showEmailLogin && !showForgotPassword && authStep === 'loginPassword' && (
        <>
          <Text fontSize={14} color={AUTH_COLORS.textSecondary}>
            {maskPhoneNumber(phoneNumber)}
          </Text>
          <PasswordInput
            placeholder="輸入密碼"
            value={password}
            onChangeText={setPassword}
          />
        </>
      )}

      {/* Phone-first: register with password then OTP */}
      {!showEmailLogin && !showForgotPassword && authStep === 'registerPassword' && (
        <>
          <Text fontSize={14} color={AUTH_COLORS.textSecondary}>
            {maskPhoneNumber(phoneNumber)}
          </Text>
          <PasswordInput
            placeholder="輸入密碼"
            value={password}
            onChangeText={setPassword}
          />
        </>
      )}

      <FormButton
        title={getButtonTitle()}
        onPress={getButtonHandler()}
        disabled={primaryDisabled}
      />

      {/* Links: email login mode */}
      {showEmailLogin && (
        <LinkText
          normalText=""
          linkText="使用手機登入"
          onLinkPress={() => onSwitchToPhoneLogin?.()}
        />
      )}

      {/* Links: forgot password */}
      {showForgotPassword && (
        <LinkText normalText="" linkText="返回" onLinkPress={() => onForgotPasswordBack?.()} />
      )}

      {/* Links: phone step */}
      {!showEmailLogin && !showForgotPassword && authStep === 'phone' && (
        <LinkText
          normalText=""
          linkText="使用 Email 登入"
          onLinkPress={() => setLoginMode?.('email')}
        />
      )}

      {/* Links: login password */}
      {!showEmailLogin && !showForgotPassword && authStep === 'loginPassword' && (
        <>
          <LinkText
            normalText=""
            linkText="忘記密碼？"
            onLinkPress={() => onForgotPasswordPress?.()}
          />
          <LinkText
            normalText=""
            linkText="使用 Email 登入"
            onLinkPress={() => setLoginMode?.('email')}
          />
          <LinkText
            normalText="號碼有誤嗎？"
            linkText="更換號碼"
            onLinkPress={() => onChangePhoneNumber?.()}
          />
        </>
      )}

      {/* Links: register password */}
      {!showEmailLogin && !showForgotPassword && authStep === 'registerPassword' && (
        <LinkText
          normalText="已經有帳號了嗎？"
          linkText="返回"
          onLinkPress={() => onChangePhoneNumber?.()}
        />
      )}
    </YStack>
  );
};

export default LoginFormContainer;
