import { useEffect, useState, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Text, Button, YStack } from 'tamagui';
import { authAPI } from '../../utils/api';

export default function VerifyEmail() {
  const { token, email } = useLocalSearchParams<{ token: string; email: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const requestSent = useRef(false);

  useEffect(() => {
    if (requestSent.current || !token) {
      if (!token) {
        setStatus('error');
        setMessage('缺少驗證令牌');
      }
      return;
    }
    requestSent.current = true;

    const verifyToken = async () => {
      try {
        const result = await authAPI.verifyEmail(token);
        setStatus('success');
        setMessage(result.message || '電子郵件驗證成功！');
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      } catch (error: any) {
        setStatus('error');
        const errorMessage = error?.message || '驗證失敗，請重試';
        setMessage(errorMessage);
      }
    };

    verifyToken();
  }, [token]);

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
      {status === 'loading' && (
        <YStack alignItems="center" gap="$4">
          <ActivityIndicator size="large" color="#FFAD31" />
          <Text fontSize="$5" color="$color">驗證中...</Text>
        </YStack>
      )}
      
      {status === 'success' && (
        <YStack alignItems="center" gap="$4">
          <Text fontSize="$8" color="$green10">✓</Text>
          <Text fontSize="$6" fontWeight="bold" color="$green10" textAlign="center">
            {message}
          </Text>
          <Text fontSize="$4" color="$color" textAlign="center">
            即將跳轉到登入頁面...
          </Text>
        </YStack>
      )}
      
      {status === 'error' && (
        <YStack alignItems="center" gap="$4" maxWidth={350}>
          <Text fontSize="$8" color="$red10">✗</Text>
          <Text fontSize="$6" fontWeight="bold" color="$red10" textAlign="center">
            驗證失敗
          </Text>
          <Text fontSize="$4" color="$color" textAlign="center">
            {message}
          </Text>
          <Button
            backgroundColor="$orange10"
            color="white"
            marginTop="$4"
            onPress={() => router.replace('/login')}
            width={200}
          >
            返回登入
          </Button>
        </YStack>
      )}
    </YStack>
  );
}

