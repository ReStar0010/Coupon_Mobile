import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface WidgetErrorFallbackProps {
  message: string;
  minHeight?: number;
}

const WidgetErrorFallback: React.FC<WidgetErrorFallbackProps> = ({ message, minHeight = 120 }) => {
  return (
    <View style={[styles.container, { minHeight }]}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  message: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
  },
});

export default WidgetErrorFallback;
