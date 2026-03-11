import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from './Input';
import type { InputProps } from './Input';
import { colors } from '@/constants/colors';

export interface PasswordInputProps extends Omit<InputProps, 'secureTextEntry'> {
  placeholder: string;
}

export const PasswordInput = React.forwardRef<any, PasswordInputProps>(
  (props, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <View style={styles.container}>
        <Input
          ref={ref}
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
            color={colors.textSecondary}
          />
        </Pressable>
      </View>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  input: {
    paddingRight: 44,
  },
  iconButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
