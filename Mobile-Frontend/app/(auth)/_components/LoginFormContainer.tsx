import React from 'react';
import { FormHeader } from '@/app/components/forms/FormHeader';
import { FormInput } from '@/app/components/forms/FormInput';
import { FormButton } from '@/app/components/forms/FormButton';
import { LinkText } from '@/app/components/forms/LinkText';
import { YStack } from 'tamagui';

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
  onLoginPress?: () => void;
  onRegisterPress?: () => void;
  onForgotPasswordPress?: () => void;
  mode?: 'login' | 'register' | 'forgotPassword';
  setMode?: (mode: 'login' | 'register' | 'forgotPassword') => void;
  loginMode?: 'phone' | 'email';
  setLoginMode?: (mode: 'phone' | 'email') => void;
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
  onLoginPress,
  onRegisterPress,
  onForgotPasswordPress,
  mode,
  loginMode = 'phone',
  setLoginMode,
}) => {
  const getTitle = () => {
    switch (mode) {
      case 'login':
        return '登入';
      case 'register':
        return '註冊';
      case 'forgotPassword':
        return '忘記密碼';
      default:
        return '登入';
    }
  };

  const getButtonTitle = () => {
    switch (mode) {
      case 'login':
        return '登入';
      case 'register':
        return '註冊';
      case 'forgotPassword':
        return '發送驗證碼';
      default:
        return '登入';
    }
  };

  const getButtonHandler = () => {
    switch (mode) {
      case 'login':
        return handleLogin;
      case 'register':
        return handleRegister;
      case 'forgotPassword':
        return handleForgotPassword;
      default:
        return handleLogin;
    }
  };

  return (
    <YStack bg={AUTH_COLORS.background} px="$5" py="$6" gap="$3">
      <FormHeader title={getTitle()} />

      {/* Login Mode - with phone/email toggle */}
      {mode === 'login' && (
        <>
          {loginMode === 'phone' ? (
            <FormInput
              placeholder="輸入手機號碼"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          ) : (
            <FormInput
              placeholder="輸入 Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}
          <FormInput
            placeholder="輸入密碼"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />
        </>
      )}

      {/* Register Mode - phone only */}
      {mode === 'register' && (
        <>
          <FormInput
            placeholder="輸入手機號碼"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <FormInput
            placeholder="輸入密碼"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />
        </>
      )}

      {/* Forgot Password Mode - phone only */}
      {mode === 'forgotPassword' && (
        <FormInput
          placeholder="輸入手機號碼 (09XXXXXXXX)"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          autoCapitalize="none"
        />
      )}

      {/* Action Button */}
      <FormButton title={getButtonTitle()} onPress={getButtonHandler()} />

      {/* Links */}
      {mode === 'login' && (
        <>
          <LinkText
            normalText=""
            linkText={loginMode === 'phone' ? '使用 Email 登入' : '使用手機登入'}
            onLinkPress={() => setLoginMode?.(loginMode === 'phone' ? 'email' : 'phone')}
          />
          <LinkText normalText="還沒有帳號嗎？" linkText="註冊" onLinkPress={onRegisterPress} />
          <LinkText normalText="忘記密碼？" linkText="重設" onLinkPress={onForgotPasswordPress} />
        </>
      )}

      {mode === 'register' && (
        <LinkText normalText="已經有帳號了嗎？" linkText="登入" onLinkPress={onLoginPress} />
      )}

      {mode === 'forgotPassword' && (
        <LinkText normalText="還沒有帳號嗎？" linkText="註冊" onLinkPress={onRegisterPress} />
      )}
    </YStack>
  );
};

export default LoginFormContainer;
