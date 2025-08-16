import React from 'react';
import { View, Text, TextInput } from 'react-native';

interface LoginInputProps {
  label: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  value?: string;
  onChangeText?: (text: string) => void;
}

export const LoginInput: React.FC<LoginInputProps> = ({
  label,
  placeholder,
  secureTextEntry = false,
  value,
  onChangeText,
}) => {
  return (
    <View className="mb-4">
      <View className="mb-2">
        <Text className="text-gray-700 text-base">{label}</Text>
      </View>
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
    </View>
  );
};
