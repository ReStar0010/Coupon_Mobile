import React from 'react';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import { LoginHeader } from './LoginHeader';
import { LoginInput } from 'app/Login/components/LoginInput';
import { LoginButton } from './LoginButton';
import { LinkText } from './LinkText';

interface ResetFormContainterProps {
  password: string;
  setPassword: (password: string) => void;
  verifyPassword: string;
  setVerifyPassword: (verifyPassword: string) => void;
  handleReset: () => void;
}

export const ResetFormContainer: React.FC<ResetFormContainterProps> = ({
  password,
  setPassword,
  verifyPassword,
  setVerifyPassword,
  handleReset
}) => {
    
  return (
    <View className="bg-login-bg px-5 py-8 flex flex-col gap-[13px]">
      {/* Header */}
      <LoginHeader title='重設密碼' /> 
      {/* ResetPassword Input */}
      <LoginInput
        placeholder='輸入新密碼'
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />
      <LoginInput
          placeholder='再次輸入新密碼'
          value={verifyPassword}
          onChangeText={setVerifyPassword}
          secureTextEntry={true}
      /> 
      {/* Reset Button */}
      <LoginButton title="儲存變更" onPress={handleReset} />
    </View>
  );
};

export default ResetFormContainer;