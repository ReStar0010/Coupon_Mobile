import React from 'react';
import { FormHeader } from '@/app/components/forms/FormHeader';
import { FormInput } from '@/app/components/forms/FormInput';
import { FormButton } from '@/app/components/forms/FormButton';
import { LinkText } from '@/app/components/forms/LinkText';
import { YStack } from 'tamagui';

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
  setMode,
  loginMode = 'phone',
  setLoginMode,
}) => {
    
  return (
    <YStack bg="#f5f5f5" px="$5" py="$6" gap="$3">
      {/* Header */}
      {mode === 'login' && (
          <FormHeader title="登入"/>
      )}
      {mode === 'register' && (
          <FormHeader title="註冊"/>
      )}
      {mode === 'forgotPassword' && (
          <FormHeader title="忘記密碼"/>
      )}

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

      {/* Login Button */}
      {mode === 'login' && (
        <FormButton title="登入" onPress={handleLogin} />
      )}
      {mode === 'register' && (
        <FormButton title="註冊" onPress={handleRegister} />
      )}
      {mode === 'forgotPassword' && (
        <FormButton title="寄送重設密碼信件" onPress={handleForgotPassword} />
      )}

      {/* Links */}
      {/* Registration Link */}
      {mode === 'login' && (
        <>
            {/* Login Mode Toggle */}
            <LinkText
                normalText=""
                linkText={loginMode === 'phone' ? "使用 Email 登入" : "使用手機登入"}
                onLinkPress={() => setLoginMode?.(loginMode === 'phone' ? 'email' : 'phone')}
            />

            <LinkText
                normalText="還沒有帳號嗎 ? "
                linkText="註冊"
                onLinkPress={onRegisterPress}
            />

            {/* Password Reset Link */}
            <LinkText
                normalText="忘記密碼 ? "
                linkText="重設"
                onLinkPress={onForgotPasswordPress}
            />
        </>
      )}
      {mode === 'register' && (
        <>
            <LinkText
                normalText="已經有帳號了嗎 ? "
                linkText="登入"
                onLinkPress={onLoginPress}
            />
        </>
      )}
      {mode === 'forgotPassword' && (
        <>
            <LinkText
                normalText="還沒有帳號嗎 ? "
                linkText="註冊"
                onLinkPress={onRegisterPress}
            />
        </>
      )}
    </YStack>
  );
};

export default LoginFormContainer;