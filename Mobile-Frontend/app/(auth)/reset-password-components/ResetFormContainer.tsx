import React from 'react';
import { View } from 'react-native';
import { FormHeader } from '@/app/components/forms/FormHeader';
import { FormInput } from '@/app/components/forms/FormInput';
import { FormButton } from '@/app/components/forms/FormButton';

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
      <FormHeader title='重設密碼' /> 
      {/* ResetPassword Input */}
      <FormInput
        placeholder='輸入新密碼'
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />
      <FormInput
          placeholder='再次輸入新密碼'
          value={verifyPassword}
          onChangeText={setVerifyPassword}
          secureTextEntry={true}
      /> 
      {/* Reset Button */}
      <FormButton title="儲存變更" onPress={handleReset} />
    </View>
  );
};

export default ResetFormContainer;