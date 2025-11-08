import React from 'react';
import { Input as TamaguiInput, InputProps as TamaguiInputProps, YStack } from 'tamagui';
import { colors } from '@/constants/colors';

export interface InputProps extends Omit<TamaguiInputProps, 'size'> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<any, InputProps>(
  ({ label, error, placeholder, ...props }, ref) => {
    return (
      <YStack gap="$1" width="100%">
        {label && (
          <TamaguiInput.Label fontSize="$sm" color={colors.textPrimary}>
            {label}
          </TamaguiInput.Label>
        )}
        <TamaguiInput
          ref={ref}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          backgroundColor={colors.background}
          borderColor={colors.border}
          borderWidth={1}
          borderRadius="$4"
          height={44}
          paddingHorizontal="$3-5"
          fontSize="$md"
          color={colors.textPrimary}
          fontFamily="$body"
          {...props}
        />
        {error && (
          <TamaguiInput.Label fontSize="$xs" color={colors.error} marginTop="$1">
            {error}
          </TamaguiInput.Label>
        )}
      </YStack>
    );
  }
);

Input.displayName = 'Input';

