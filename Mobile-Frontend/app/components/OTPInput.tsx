import React, { useRef, useState, useEffect } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import { XStack } from 'tamagui';

interface OTPInputProps {
  /** Number of digits in the OTP code */
  length?: number;
  /** Callback when all digits are entered */
  onComplete: (code: string) => void;
  /** Callback on code change */
  onChange?: (code: string) => void;
  /** Auto-submit when complete */
  autoSubmit?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
}

/**
 * OTPInput Component
 * 
 * A mobile-friendly OTP input with 6 individual boxes for touch-friendly input.
 * Features:
 * - Auto-advance focus on digit entry
 * - Backspace navigates to previous box
 * - Auto-submit when 6th digit entered
 * - Support paste of full 6-digit code
 */
export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  onComplete,
  onChange,
  autoSubmit = true,
  disabled = false,
  error = false,
}) => {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    if (!disabled) {
      inputs.current[0]?.focus();
    }
  }, [disabled]);

  const handleChange = (text: string, index: number) => {
    // Handle paste of full code
    if (text.length === length && /^\d+$/.test(text)) {
      const digits = text.split('');
      setOtp(digits);
      onChange?.(text);
      
      // Focus last input
      inputs.current[length - 1]?.focus();
      
      // Auto-submit if enabled
      if (autoSubmit) {
        onComplete(text);
      }
      return;
    }

    // Handle single digit entry
    if (text.length > 1) {
      text = text.slice(-1); // Take only last character
    }

    if (text && !/^\d$/.test(text)) {
      return; // Only allow digits
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    const code = newOtp.join('');
    onChange?.(code);

    // Auto-advance to next input
    if (text && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (text && index === length - 1) {
      const fullCode = newOtp.join('');
      if (fullCode.length === length && autoSubmit) {
        onComplete(fullCode);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    // Select text on focus for easy replacement
    inputs.current[index]?.setSelection(0, 1);
  };

  return (
    <XStack gap="$2" justifyContent="center">
      {otp.map((digit, index) => (
        <View key={index} style={styles.inputContainer}>
          <TextInput
            ref={(ref) => (inputs.current[index] = ref)}
            style={[
              styles.input,
              error && styles.inputError,
              disabled && styles.inputDisabled,
              digit && styles.inputFilled,
            ]}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            onFocus={() => handleFocus(index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            editable={!disabled}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
        </View>
      ))}
    </XStack>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    width: 45,
    height: 55,
  },
  input: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: '#374151',
    fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif',
  },
  inputFilled: {
    borderColor: '#FFAD31',
    backgroundColor: '#FFF9F0',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputDisabled: {
    backgroundColor: '#E5E7EB',
    color: '#9CA3AF',
  },
});

export default OTPInput;

