import React from 'react';
import { View } from 'react-native';
import { LoginHeader } from './LoginHeader';
import { LoginInput } from '../LoginInput';
import { LoginButton } from '../LoginButton';
import { LinkText } from '../LinkText';

interface LoginFormContainerProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  handleLogin: () => void;
  onRegisterPress?: () => void;
  onForgotPasswordPress?: () => void;
}

export const LoginFormContainer: React.FC<LoginFormContainerProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  handleLogin,
  onRegisterPress,
  onForgotPasswordPress,
}) => {
  return (
    <View className="bg-login-bg px-5 py-8 flex flex-col gap-[13px]">
      {/* Header */}
      <LoginHeader />

      {/* Email Input */}
      <LoginInput
        placeholder="輸入 Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* Password Input */}
      <LoginInput
        placeholder="輸入密碼"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />

      {/* Login Button */}
      <LoginButton title="登入" onPress={handleLogin} />

      {/* Registration Link */}
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
    </View>
  );
};

export default LoginFormContainer;