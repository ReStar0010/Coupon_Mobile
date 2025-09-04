import React from 'react';
import { TextInputProps } from 'react-native';
import { Input } from 'tamagui';

interface LoginInputProps extends TextInputProps {
  placeholder: string;
  secureTextEntry?: boolean;
}

export const LoginInput: React.FC<LoginInputProps> = ({
  placeholder,
  secureTextEntry = false,
  ...props
}) => {
  return (
    <Input
      secureTextEntry={secureTextEntry}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      bg="#f5f5f5"
      borderColor="#e0e0e0"
      borderWidth={1}
      height={41}
      px="$3"
      fontSize={16}
      color="#374151"
      autoCapitalize="none"
      style={{ 
        fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif',
        borderRadius: 9
      }}
      {...props}
    />
  );
};
