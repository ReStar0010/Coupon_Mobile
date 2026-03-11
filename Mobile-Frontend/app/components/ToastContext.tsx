import React, { createContext, useContext, useState, useRef } from 'react';
import { View, Text, Animated, Platform } from 'react-native';

// Define the context type
interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

// Create the context with a default value
const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

// Custom hook to use the toast context
export const useToast = () => useContext(ToastContext);

// The duration of the toast in milliseconds
const TOAST_DURATION = 3000;

// Toast provider component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const getToastStyle = (type: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        return { backgroundColor: '#10B981', icon: '✓' };
      case 'error':
        return { backgroundColor: '#EF4444', icon: '✗' };
      case 'info':
        return { backgroundColor: '#3B82F6', icon: 'i' };
      default:
        return { backgroundColor: '#10B981', icon: '✓' };
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set the message and type
    setMessage(text);
    setToastType(type);
    setVisible(true);

    // Animate in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
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
      Animated.timing(translateY, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
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

  const toastStyle = getToastStyle(toastType);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {visible && message && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 100 : 80,
            left: 20,
            right: 20,
            backgroundColor: toastStyle.backgroundColor,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            zIndex: 1000,
            transform: [{ translateY }],
            opacity,
          }}
        >
          <View className="flex-row items-center">
            <Text className="mr-2 text-base font-bold text-white">{toastStyle.icon}</Text>
            <Text className="flex-1 text-base text-white" numberOfLines={2}>
              {message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};
export default ToastProvider;
