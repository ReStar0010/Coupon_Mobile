import React from 'react';
import { YStack } from 'tamagui';
import { FormHeader } from '@/app/components/forms/FormHeader';
import { PasswordInput } from '@/app/components/forms/PasswordInput';
import { FormButton } from '@/app/components/forms/FormButton';
import { AUTH_COLORS } from './LoginFormContainer';

interface ResetFormContainerProps {
  password: string;
  setPassword: (password: string) => void;
  verifyPassword: string;
  setVerifyPassword: (verifyPassword: string) => void;
  handleReset: () => void;
}

export const ResetFormContainer: React.FC<ResetFormContainerProps> = ({
  password,
  setPassword,
  verifyPassword,
  setVerifyPassword,
  handleReset,
}) => {
  return (
    <YStack bg={AUTH_COLORS.background} px="$5" py="$6" gap="$3">
      <FormHeader title="重設密碼" />

      <PasswordInput
        placeholder="輸入新密碼"
        value={password}
        onChangeText={setPassword}
      />

      <PasswordInput
        placeholder="再次輸入新密碼"
        value={verifyPassword}
        onChangeText={setVerifyPassword}
      />

      <FormButton title="儲存變更" onPress={handleReset} />
    </YStack>
  );
};

export default ResetFormContainer;
