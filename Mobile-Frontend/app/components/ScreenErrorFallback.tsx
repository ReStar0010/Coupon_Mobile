import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface ScreenErrorFallbackProps {
  error: Error;
  componentStack: string | null;
  resetError: () => void;
}

const ScreenErrorFallback: React.FC<ScreenErrorFallbackProps> = ({ resetError }) => {
  const router = useRouter();

  const handleGoToEasyuse = () => {
    // Reset error, then replace the entire stack to the easyuse tab
    resetError(); // Optional: could skip if navigation alone is always sufficient
    router.replace('/(tabs)/easyuse');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.message}>發生錯誤，請稍後再試</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={resetError} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>重新載入</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleGoToEasyuse}
        activeOpacity={0.8}
      >
        <Text style={styles.secondaryButtonText}>返回</Text>
      </TouchableOpacity>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  message: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#FFAD31',
    borderRadius: 12,
    paddingVertical: 12,
    width: '80%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  secondaryButtonText: {
    color: '#707070',
    fontSize: 16,
  },
});

export default ScreenErrorFallback;
