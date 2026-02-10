import React, { useState, useEffect } from 'react';
import { Alert, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { YStack, XStack, H4, Button, Text, Card } from 'tamagui';
import { ChevronLeft, Mail, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAPI } from '@/app/utils/authAPI';
import Toast from 'react-native-toast-message';

/**
 * EmailSettings - Email settings screen (mirroring phone-settings UX)
 * 
 * Users can optionally add and verify their email address.
 * Email verification uses the existing backend email verification flow.
 */
export default function EmailSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadEmail();
  }, []);

  // Reload email when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadEmail();
    }, [])
  );

  const loadEmail = async () => {
    try {
      const response = await fetchAPI('/user-info/', { method: 'GET' });
      const data = response.data;
      setEmail(data.email || '');
      setVerified(data.verified || false);
    } catch (error) {
      console.error('Failed to load email:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      Toast.show({
        type: 'failRed',
        text1: '請輸入有效的 Email 地址',
        position: 'bottom',
        visibilityTime: 2000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call backend to send verification email
      await fetchAPI('/update-email/', {
        method: 'POST',
        data: { email: newEmail },
      });

      Toast.show({
        type: 'successGreen',
        text1: '驗證信件已發送',
        text2: '請檢查您的信箱並點擊驗證連結',
        position: 'bottom',
        visibilityTime: 3000,
      });

      setNewEmail('');
      // Reload email info
      await loadEmail();
    } catch (error: any) {
      console.error('Failed to send verification email:', error);
      const errorMessage = error?.response?.data?.error || '發送驗證信件失敗，請重試';
      Toast.show({
        type: 'failRed',
        text1: errorMessage,
        position: 'bottom',
        visibilityTime: 2000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} px="$4" py="$6" gap="$4" style={{ paddingTop: insets.top + 10 }}>
        <XStack gap="$3" alignItems="center">
          <ChevronLeft size={24} onPress={() => router.back()} />
          <H4 fontWeight="bold">Email 設定</H4>
        </XStack>

        {loading ? (
          <Text>載入中...</Text>
        ) : (
          <YStack gap="$4">
            {/* Info notice */}
            <Card bordered p="$4" bg="$blue2" borderColor="$blue6">
              <XStack gap="$3" alignItems="flex-start">
                <Shield size={24} color="#3B82F6" />
                <YStack flex={1} gap="$2">
                  <Text fontWeight="600" color="$blue11">
                    Email 為選填項目
                  </Text>
                  <Text color="$blue11" fontSize="$3" lineHeight={20}>
                    新增或更改 Email 時需要透過驗證信件確認。Email 可用於帳號安全和通知。
                  </Text>
                </YStack>
              </XStack>
            </Card>

            {/* Current email display */}
            <Card bordered p="$4">
              <YStack gap="$4">
                <YStack gap="$2">
                  <Text color="$gray10" fontSize="$3">
                    目前的 Email
                  </Text>
                  {email ? (
                    <>
                      <Text fontSize="$6" fontWeight="600" color="$gray11">
                        {email}
                      </Text>
                      {verified ? (
                        <XStack gap="$2" alignItems="center">
                          <Shield size={16} color="#10B981" />
                          <Text fontSize="$3" color="#10B981" fontWeight="600">
                            已驗證
                          </Text>
                        </XStack>
                      ) : (
                        <XStack gap="$2" alignItems="center">
                          <Shield size={16} color="#EF4444" />
                          <Text fontSize="$3" color="#EF4444" fontWeight="600">
                            未驗證
                          </Text>
                        </XStack>
                      )}
                    </>
                  ) : (
                    <Text fontSize="$5" color="$gray10">
                      尚未設定
                    </Text>
                  )}
                </YStack>
              </YStack>
            </Card>

            {/* Add/Change email form */}
            <Card bordered p="$4">
              <YStack gap="$4">
                <Text fontWeight="600" fontSize="$5">
                  {email ? '更改 Email' : '新增 Email'}
                </Text>

                <YStack gap="$2">
                  <Text color="$gray10" fontSize="$3">
                    Email 地址
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#ddd',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      backgroundColor: 'white',
                    }}
                    placeholder="輸入 Email 地址"
                    value={newEmail}
                    onChangeText={setNewEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isSubmitting}
                  />
                </YStack>

                <Button
                  backgroundColor="#007AFF"
                  color="white"
                  onPress={handleAddOrChangeEmail}
                  disabled={isSubmitting || !newEmail}
                  opacity={isSubmitting || !newEmail ? 0.5 : 1}
                >
                  {isSubmitting ? '發送中...' : '發送驗證信件'}
                </Button>
              </YStack>
            </Card>
          </YStack>
        )}
      </YStack>
    </>
  );
}
