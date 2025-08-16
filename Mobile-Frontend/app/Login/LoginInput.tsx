import React from 'react';
import { View, TextInput, TextInputProps } from 'react-native';

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
    <View className="flex h-[41px] px-4 items-center border border-login-border bg-login-dark rounded-[9px]">
      <TextInput
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        className="flex-1 bg-transparent text-login-light-gray text-base font-normal outline-none"
        style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
};
