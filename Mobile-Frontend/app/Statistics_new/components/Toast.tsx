import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface ToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ 
  visible, 
  message, 
  onHide, 
  duration = 3000 
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

  if (!visible && fadeAnim._value === 0) {
    return null;
  }

  return (
    <View className="absolute bottom-20 left-0 right-0 items-center px-5">
      <Animated.View
        className="rounded-full bg-toast-green px-6 py-4"
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
          backgroundColor: 'rgba(76, 195, 138, 0.8)',
        }}
      >
        <Text className="text-center text-[14px] font-normal leading-normal text-white">
          {message}
        </Text>
      </Animated.View>
    </View>
  );
};

export default Toast;
