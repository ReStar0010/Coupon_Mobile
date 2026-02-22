import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { YStack, Text } from 'tamagui';

interface StatisticsToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration?: number;
}

const StatisticsToast: React.FC<StatisticsToastProps> = ({
  visible,
  message,
  onHide,
  duration = 3000,
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

  return (
    <YStack
      style={{
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
      }}
      items="center"
      px="$5">
      <Animated.View
        style={{
          borderRadius: 999,
          backgroundColor: 'rgba(76, 195, 138, 0.8)',
          paddingHorizontal: 24,
          paddingVertical: 16,
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
        }}>
        <Text style={{ textAlign: 'center' }} fontSize={14} fontWeight="normal" color="white">
          {message}
        </Text>
      </Animated.View>
    </YStack>
  );
};

export default StatisticsToast;
