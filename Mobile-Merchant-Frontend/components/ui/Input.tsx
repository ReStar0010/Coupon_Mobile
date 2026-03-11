import React from 'react';
import { Input as TamaguiInput, InputProps as TamaguiInputProps, Text, YStack } from 'tamagui';
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
          <Text fontSize="$sm" color={colors.textPrimary}>
            {label}
          </Text>
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
          <Text fontSize="$xs" color={colors.error} marginTop="$1">
            {error}
          </Text>
        )}
      </YStack>
    );
  },
);

Input.displayName = 'Input';
