import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { YStack, XStack, H4, Input, Button, Text, Card } from 'tamagui';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAPI } from '../../utils/authAPI';

export default function PhoneSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPhone();
  }, []);

  const loadPhone = async () => {
    try {
      const response = await fetchAPI('/user/phone/');
      const data = response.data;
      setPhone(data.phone_number || '');
      setMaskedPhone(data.phone_number_masked);
    } catch (error) {
      console.error('Failed to load phone:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePhone = async () => {
    if (!phone.match(/^09\d{8}$/)) {
      Alert.alert('格式錯誤', '請輸入有效的台灣手機號碼（09開頭，共10碼）');
      return;
    }

    setSaving(true);
    try {
      const response = await fetchAPI('/user/phone/', {
        method: 'PUT',
        data: { phone_number: phone }
      });
      const data = response.data;

      setMaskedPhone(data.phone_number_masked);

      if (data.pending_coupons_claimed > 0) {
        Alert.alert(
          '設定成功',
          `手機號碼已儲存，您有 ${data.pending_coupons_claimed} 張優惠券已自動領取！`
        );
      } else {
        Alert.alert('設定成功', '手機號碼已儲存');
      }
    } catch (error: any) {
      Alert.alert('錯誤', error.message || '儲存手機號碼失敗');
    } finally {
      setSaving(false);
    }
  };

  const deletePhone = async () => {
    Alert.alert(
      '確認刪除',
      '您確定要刪除已註冊的手機號碼嗎？已領取的優惠券不會受影響。',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetchAPI('/user/phone/', { method: 'DELETE' });
              setPhone('');
              setMaskedPhone(null);
              Alert.alert('成功', '手機號碼已刪除');
            } catch (error: any) {
              Alert.alert('錯誤', error.message || '刪除手機號碼失敗');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} px="$4" py="$6" gap="$4" style={{ paddingTop: insets.top + 10 }}>
        <XStack gap="$3" alignItems="center">
          <ChevronLeft size={24} onPress={() => router.back()} />
          <H4 fontWeight="bold">手機號碼</H4>
        </XStack>

        {loading ? (
          <Text>載入中...</Text>
        ) : (
          <Card bordered p="$4">
            <YStack gap="$4">
              <Text color="$gray10">
                註冊您的手機號碼，即可接收商家直接發送的優惠券。
              </Text>

              <Input
                placeholder="0912345678"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />

              {maskedPhone && (
                <Text color="$gray11" fontSize="$2">
                  目前已註冊：{maskedPhone}
                </Text>
              )}

              <Button
                onPress={savePhone}
                disabled={saving || !phone}
                bg={saving ? '$gray5' : '#ffad31'}
              >
                {saving ? '儲存中...' : '儲存手機號碼'}
              </Button>

              {maskedPhone && (
                <Button
                  onPress={deletePhone}
                  variant="outlined"
                  borderColor="$red10"
                  color="$red10"
                >
                  刪除手機號碼
                </Button>
              )}
            </YStack>
          </Card>
        )}
      </YStack>
    </>
  );
}

