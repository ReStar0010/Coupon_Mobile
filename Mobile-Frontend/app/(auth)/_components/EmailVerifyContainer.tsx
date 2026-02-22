import React from 'react';
import { ActivityIndicator, View as RNView, StyleSheet } from 'react-native';
import { Text } from 'tamagui';
import { AUTH_COLORS } from './LoginFormContainer';

interface EmailVerifyContainerProps {
  token: string | null;
  message: string;
  error: string | null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  card: {
    marginTop: 32,
    minHeight: 200,
    width: '100%',
    maxWidth: 330,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.white,
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageContainer: {
    alignItems: 'center',
  },
});

export const EmailVerifyContainer: React.FC<EmailVerifyContainerProps> = ({
  token,
  message,
  error,
}) => {
  return (
    <RNView style={styles.container}>
      <RNView style={styles.card}>
        <RNView style={styles.content}>
          {!token ? (
            <Text style={{ textAlign: 'center' }} fontSize={16} fontWeight="500" color="#dc2626">
              驗證連結錯誤，缺少驗證碼。
            </Text>
          ) : error ? (
            <Text style={{ textAlign: 'center' }} fontSize={16} fontWeight="500" color="#dc2626">
              {error}
            </Text>
          ) : message ? (
            <RNView style={styles.messageContainer}>
              <ActivityIndicator size="large" color="#22c55e" style={{ marginBottom: 16 }} />
              <Text style={{ textAlign: 'center' }} fontSize={16} fontWeight="500" color="#15803d">
                {message}
              </Text>
            </RNView>
          ) : null}
        </RNView>
      </RNView>
    </RNView>
  );
};

export default EmailVerifyContainer;
