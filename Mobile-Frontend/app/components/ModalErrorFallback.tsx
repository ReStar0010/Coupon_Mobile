import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ModalErrorFallbackProps {
  onDismiss: () => void;
}

const ModalErrorFallback: React.FC<ModalErrorFallbackProps> = ({ onDismiss }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>抽獎功能暫時無法使用</Text>
      <TouchableOpacity style={styles.button} onPress={onDismiss} activeOpacity={0.8}>
        <Text style={styles.buttonText}>關閉</Text>
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
  },
  message: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#FFAD31',
    borderRadius: 12,
    paddingVertical: 12,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ModalErrorFallback;
