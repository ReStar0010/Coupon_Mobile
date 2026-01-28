import React, { useEffect, useState } from 'react';
import { RefreshControl, Alert } from 'react-native';
import { XStack, View, Text, Card, Button, Spinner, YStack, ScrollView, H4 } from 'tamagui';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBlockedMerchants } from '../../components/providers/BlockedMerchantsProvider';

export default function BlockedMerchantsScreen() {
  const { blockedMerchants, isLoading, unblockStore, refresh } = useBlockedMerchants();
  const [refreshing, setRefreshing] = useState(false);
  const [unblocking, setUnblocking] = useState<number | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    refresh();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleUnblock = (storeId: number, storeName: string) => {
    Alert.alert(
      '解除封鎖',
      `確定要解除封鎖「${storeName}」嗎？`,
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '確定',
          onPress: async () => {
            setUnblocking(storeId);
            try {
              const success = await unblockStore(storeId);
              if (success) {
                Alert.alert('成功', '已解除封鎖');
              } else {
                Alert.alert('錯誤', '解除封鎖失敗，請稍後再試');
              }
            } catch (error) {
              Alert.alert('錯誤', '解除封鎖失敗，請稍後再試');
            } finally {
              setUnblocking(null);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        px="$4"
        py="$6"
        style={{ paddingTop: insets.top + 10 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header with back button and title */}
        <XStack gap={'$3'} items="center">
          <ChevronLeft size={24} onPress={() => router.push('/OptionsMenu')} color={'black'} />
          <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
            封鎖的商家
          </H4>
        </XStack>

        <YStack mt="$5" gap="$3">
          {isLoading && !refreshing && blockedMerchants.length === 0 ? (
            <View p="$4" ai="center">
              <Spinner size="large" />
              <Text mt="$2" color="$gray10">
                載入中...
              </Text>
            </View>
          ) : blockedMerchants.length === 0 ? (
            <Card padding="$4" backgroundColor="$background">
              <YStack ai="center" gap="$2">
                <Text fontSize="$5" fontWeight="600">
                  沒有封鎖的商家
                </Text>
                <Text fontSize="$3" color="$gray10" ta="center">
                  當您封鎖商家時，他們的優惠券將不會出現在您的動態中
                </Text>
              </YStack>
            </Card>
          ) : (
            blockedMerchants.map((blocked) => (
              <Card key={blocked.id} padding="$3" backgroundColor="$background">
                <XStack jc="space-between" ai="center" gap="$3">
                  <YStack flex={1}>
                    <Text fontSize="$5" fontWeight="600">
                      {blocked.store.name}
                    </Text>
                    <Text fontSize="$2" color="$gray10" mt="$1">
                      封鎖於 {new Date(blocked.created_at).toLocaleDateString('zh-TW')}
                    </Text>
                  </YStack>
                  <Button
                    size="$3"
                    theme="blue"
                    onPress={() => handleUnblock(blocked.store.id, blocked.store.name)}
                    disabled={unblocking === blocked.store.id}
                  >
                    {unblocking === blocked.store.id ? (
                      <Spinner size="small" color="$white" />
                    ) : (
                      '解除封鎖'
                    )}
                  </Button>
                </XStack>
              </Card>
            ))
          )}
        </YStack>
      </ScrollView>
    </>
  );
}