import React from 'react';
import { Text } from 'tamagui';
import { LoginHeader } from './LoginHeader';
import { LoginInput } from 'app/Login/components/LoginInput';
import { LoginButton } from './LoginButton';
import { LinkText } from './LinkText';
import { YStack } from 'tamagui';
import { API_URL } from 'app/config/api';

interface LoginFormContainerProps {
  email: string;
  setEmail: (email: string) => void;
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
}

export const LoginFormContainer: React.FC<LoginFormContainerProps> = ({
  email,
  setEmail,
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
}) => {
    
  return (
    <YStack bg="#f5f5f5" px="$5" py="$6" gap="$3">
      {/* Header */}
      {mode === 'login' && (
          <LoginHeader title="登入"/>
      )}
      {mode === 'register' && (
          <LoginHeader title="註冊"/>
      )}
      {mode === 'forgotPassword' && (
          <LoginHeader title="忘記密碼"/>
      )}

      {/* Email Input */}
      {(mode === 'login' || mode === 'register') && (
        <>
          <LoginInput
            placeholder="輸入 Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
    
          <LoginInput
            placeholder="輸入密碼"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />
        </>
      )} 
      {mode === 'forgotPassword' && (
        <LoginInput
          placeholder="輸入 Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      )}

      {/* Login Button */}
      {mode === 'login' && (
        <LoginButton title="登入" onPress={handleLogin} />
      )}
      {mode === 'register' && (
        <LoginButton title="註冊" onPress={handleRegister} />
      )}
      {mode === 'forgotPassword' && (
        <LoginButton title="寄送重設密碼信件" onPress={handleForgotPassword} />
      )}

      {/* Links */}
      {/* Registration Link */}
      {mode === 'login' && (
        <>
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