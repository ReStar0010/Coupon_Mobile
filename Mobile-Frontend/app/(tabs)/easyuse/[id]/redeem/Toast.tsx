import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { YStack, Text } from 'tamagui';

interface ToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration?: number;
  type?: 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  onHide,
  duration = 3000,
  type = 'error',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const hideTimer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(hideTimer);
    } else {
      hideToast();
    }
  }, [visible, duration]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible && (fadeAnim as any)._value === 0) {
    return null;
  }

  const backgroundColor =
    type === 'error'
      ? 'rgba(239, 68, 68, 0.9)' // Red for errors
      : 'rgba(76, 195, 138, 0.8)'; // Green for success

  return (
    <YStack
      style={{
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
      items="center"
      px="$5">
      <Animated.View
        style={{
          borderRadius: 12,
          backgroundColor: backgroundColor,
          paddingHorizontal: 24,
          paddingVertical: 16,
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
          maxWidth: '90%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}>
        <Text style={{ textAlign: 'center' }} fontSize={14} fontWeight="500" color="white">
          {message}
        </Text>
      </Animated.View>
    </YStack>
  );
};

export default Toast;
