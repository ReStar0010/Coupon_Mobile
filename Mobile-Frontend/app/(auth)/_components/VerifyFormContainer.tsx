import React from 'react';
import { ActivityIndicator, View as RNView, StyleSheet } from 'react-native';
import { Text, Input, Button, YStack } from 'tamagui';
import { FormHeader } from '@/app/components/forms/FormHeader';
import { AUTH_COLORS } from './LoginFormContainer';

interface VerifyFormContainerProps {
  mode: 'register' | 'forgotPassword';
  phoneNumber: string;
  otpCode: string;
  setOtpCode: (code: string) => void;
  newPassword?: string;
  setNewPassword?: (password: string) => void;
  onVerify: () => void;
  isLoading: boolean;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: AUTH_COLORS.white,
    padding: 24,
    borderRadius: 16,
    gap: 16,
  },
});

export const VerifyFormContainer: React.FC<VerifyFormContainerProps> = ({
  mode,
  phoneNumber,
  otpCode,
  setOtpCode,
  newPassword,
  setNewPassword,
  onVerify,
  isLoading,
}) => {
  const getTitle = () => {
    return mode === 'register' ? '驗證手機號碼' : '重設密碼';
  };

  return (
    <RNView style={styles.container}>
      <FormHeader title={getTitle()} />

      <Text fontSize={14} color={AUTH_COLORS.textSecondary} style={{ textAlign: 'center' }} mb="$2">
        驗證碼已發送至 {phoneNumber}
      </Text>

      <YStack gap="$3">
        <Input
          placeholder="輸入 6 位數驗證碼"
          value={otpCode}
          onChangeText={setOtpCode}
          keyboardType="number-pad"
          maxLength={6}
          bg={AUTH_COLORS.inputBackground}
          borderColor={AUTH_COLORS.border}
          borderWidth={1}
          height={41}
          px="$3"
          fontSize={16}
          color={AUTH_COLORS.text}
          style={{ borderRadius: 9 }}
        />

        {mode === 'forgotPassword' && setNewPassword && (
          <Input
            placeholder="輸入新密碼"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            bg={AUTH_COLORS.inputBackground}
            borderColor={AUTH_COLORS.border}
            borderWidth={1}
            height={41}
            px="$3"
            fontSize={16}
            color={AUTH_COLORS.text}
            style={{ borderRadius: 9 }}
          />
        )}

        <Button
          bg={AUTH_COLORS.primary}
          height={41}
          style={{ borderRadius: 9 }}
          borderWidth={0}
          pressStyle={{ bg: AUTH_COLORS.primaryPressed }}
          onPress={onVerify}
          disabled={isLoading}
          opacity={isLoading ? 0.5 : 1}
        >
          {isLoading ? (
            <ActivityIndicator color={AUTH_COLORS.text} size="small" />
          ) : (
            <Text fontSize={16} fontWeight="normal" color={AUTH_COLORS.text}>
              驗證
            </Text>
          )}
        </Button>
      </YStack>
    </RNView>
  );
};

export default VerifyFormContainer;
