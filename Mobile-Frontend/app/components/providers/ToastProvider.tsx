import React, { createContext, useContext, useState, useRef } from 'react';
import { View, Text, Animated, Dimensions } from 'react-native';

// Define context type
export interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

// Create context
export const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

// Custom hook for using toast
export const useToast = () => useContext(ToastContext);

// Toast duration in milliseconds
const TOAST_DURATION = 3000;

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const timerRef = useRef<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set the message and make toast visible
    setMessage(text);
    setToastType(type);
    setVisible(true);

    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide after duration
    timerRef.current = setTimeout(() => {
      hideToast();
    }, TOAST_DURATION);
  };

  const hideToast = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Determine background color based on toast type
  const getBackgroundColor = () => {
    switch (toastType) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'info':
        return 'bg-blue-500';
      default:
        return 'bg-green-500';
    }
  };

  // Get icon for toast type
  const getIcon = () => {
    switch (toastType) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'info':
        return 'ℹ';
      default:
        return '✓';
    }
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {visible && message && (
        <View className="absolute bottom-16 left-0 right-0 z-50 items-center px-4">
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              maxWidth: screenWidth * 0.9,
            }}
            className={`${getBackgroundColor()} flex-row items-center rounded-lg px-4 py-3 shadow-lg`}
          >
            <Text className="mr-2 text-base font-medium text-white">{getIcon()}</Text>
            <Text className="flex-1 text-center text-base text-white" numberOfLines={3}>
              {message}
            </Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
