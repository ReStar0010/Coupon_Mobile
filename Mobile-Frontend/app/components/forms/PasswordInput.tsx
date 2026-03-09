import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormInput } from './FormInput';
import type { TextInputProps } from 'react-native';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  placeholder: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = (props) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      <FormInput
        {...props}
        secureTextEntry={!showPassword}
        style={[styles.input, props.style]}
      />
      <Pressable
        onPress={() => setShowPassword((prev) => !prev)}
        style={styles.iconButton}
        hitSlop={12}
        accessibilityLabel={showPassword ? '隱藏密碼' : '顯示密碼'}
        accessibilityRole="button"
      >
        <Ionicons
          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color="#666666"
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  input: {
    paddingRight: 44,
    flex: 1,
    fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif',
    borderRadius: 9,
  },
  iconButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PasswordInput;
