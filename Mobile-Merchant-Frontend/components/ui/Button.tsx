import React from 'react';
import { Button as TamaguiButton, ButtonProps as TamaguiButtonProps } from 'tamagui';
import { colors } from '@/constants/colors';

export interface ButtonProps extends TamaguiButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<any, ButtonProps>(
  ({ variant = 'primary', fullWidth = false, children, ...props }, ref) => {
    const getVariantStyles = () => {
      switch (variant) {
        case 'primary':
          return {
            backgroundColor: colors.primary,
            color: colors.secondary,
            borderWidth: 0,
          };
        case 'secondary':
          return {
            backgroundColor: colors.background,
            color: colors.textPrimary,
            borderWidth: 1,
            borderColor: colors.border,
          };
        case 'outline':
          return {
            backgroundColor: 'transparent',
            color: colors.primary,
            borderWidth: 1,
            borderColor: colors.primary,
          };
        default:
          return {};
      }
    };

    const variantStyles = getVariantStyles();

    return (
      <TamaguiButton
        ref={ref}
        height={44}
        borderRadius="$4"
        fontSize="$md"
        fontWeight="bold"
        fontFamily="$body"
        width={fullWidth ? '100%' : undefined}
        {...variantStyles}
        {...props}
      >
        {children}
      </TamaguiButton>
    );
  }
);

Button.displayName = 'Button';

