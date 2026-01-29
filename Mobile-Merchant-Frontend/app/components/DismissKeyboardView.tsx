import React from 'react';
import { TouchableWithoutFeedback, Keyboard, View, StyleSheet } from 'react-native';

interface DismissKeyboardViewProps {
  children: React.ReactNode;
}

/**
 * Wraps content so that tapping outside focused inputs dismisses the keyboard.
 */
export function DismissKeyboardView({ children }: DismissKeyboardViewProps) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>{children}</View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
