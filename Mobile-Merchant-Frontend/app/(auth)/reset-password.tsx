import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, Button, YStack, Input } from 'tamagui';
import { authAPI } from '../../utils/api';

export default function ResetPassword() {
  const { token, email } = useLocalSearchParams<{ token: string; email: string }>();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  const handleSubmit = async () => {
    setError('');
    
    // Validation
    if (!password || !confirmPassword) {
      setError('請填寫所有欄位');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('密碼不一致');
      return;
    }
    
    if (password.length < 8) {
      setError('密碼長度至少需要8個字元');
      return;
    }

    if (!token || !email) {
      setError('缺少必要的驗證資訊');
      return;
    }

    setLoading(true);
    
    try {
      await authAPI.resetPassword(email as string, token as string, password);
      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.replace({
          pathname: '/login',
          params: { email: email as string },
        });
      }, 2000);
    } catch (error: any) {
      const errorCode = error?.response?.data?.error || error?.error;
      const errorMessage = error?.response?.data?.message || error?.message || '重設失敗，請重試';
      setErrorCode(errorCode);
      setError(errorMessage);
      
      // Check if token is expired
      if (errorMessage.includes('過期') || errorMessage.includes('expired') || errorCode === 'expired_token') {
        setIsTokenExpired(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
        <YStack alignItems="center" gap="$4">
          <Text fontSize="$8" color="$green10">✓</Text>
          <Text fontSize="$6" fontWeight="bold" color="$green10" textAlign="center">
            密碼重設成功！
          </Text>
          <Text fontSize="$4" color="$color" textAlign="center">
            即將跳轉到登入頁面...
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack flex={1} padding="$4" gap="$4" justifyContent="center" backgroundColor="$background">
          <YStack gap="$2" marginBottom="$4">
            <Text fontSize="$8" fontWeight="bold" color="$color">
              重設密碼
            </Text>
            <Text fontSize="$4" color="$gray10">
              請輸入您的新密碼
            </Text>
          </YStack>

          <YStack gap="$3">
            <YStack gap="$2">
              <Text fontSize="$4" color="$color">新密碼</Text>
              <Input
                placeholder="至少8個字元"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                borderColor="$gray8"
                focusStyle={{ borderColor: '$orange10' }}
                size="$4"
                autoCapitalize="none"
              />
            </YStack>

            <YStack gap="$2">
              <Text fontSize="$4" color="$color">確認密碼</Text>
              <Input
                placeholder="再次輸入新密碼"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                borderColor="$gray8"
                focusStyle={{ borderColor: '$orange10' }}
                size="$4"
                autoCapitalize="none"
              />
            </YStack>
          </YStack>

          {error && (
            <YStack 
              backgroundColor={isTokenExpired ? "$orange2" : "$red2"} 
              padding="$3" 
              borderRadius="$4"
              borderWidth={1}
              borderColor={isTokenExpired ? "$orange8" : "$red8"}
              gap="$2"
            >
              <Text color={isTokenExpired ? "$orange10" : "$red10"} fontSize="$3" textAlign="center">
                {error}
              </Text>
              {isTokenExpired && email && (
                <Button
                  backgroundColor="$orange10"
                  color="white"
                  marginTop="$2"
                  onPress={async () => {
                    try {
                      await authAPI.forgotPassword(email as string);
                      setError('重設密碼郵件已重新發送，請檢查您的信箱');
                      setIsTokenExpired(false);
                    } catch (err: any) {
                      setError(err?.response?.data?.message || err?.message || '重新發送失敗，請稍後再試');
                    }
                  }}
                  disabled={loading}
                  size="$3"
                >
                  重新申請密碼重設
                </Button>
              )}
            </YStack>
          )}

          <YStack gap="$3" marginTop="$4">
            <Button
              backgroundColor="$orange10"
              color="white"
              onPress={handleSubmit}
              disabled={loading}
              size="$5"
              pressStyle={{ backgroundColor: '$orange9' }}
            >
              {loading ? '處理中...' : '確認重設'}
            </Button>

            <Button
              variant="outlined"
              borderColor="$gray8"
              color="$color"
              onPress={() => router.replace('/login')}
              disabled={loading}
              size="$5"
            >
              取消
            </Button>
          </YStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

