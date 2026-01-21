import React, { useEffect, useState } from 'react';
import { ScrollView, RefreshControl, Alert } from 'react-native';
import { View, Text, Card, Button, Spinner, XStack, YStack } from 'tamagui';
import { router } from 'expo-router';
import { useBlockedMerchants } from '../../components/providers/BlockedMerchantsProvider';
import PageHeader from '../../components/PageHeader';
import Container from '../../components/Container';

export default function BlockedMerchantsScreen() {
  const { blockedMerchants, isLoading, unblockStore, refresh } = useBlockedMerchants();
  const [refreshing, setRefreshing] = useState(false);
  const [unblocking, setUnblocking] = useState<number | null>(null);

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
    <Container>
      <PageHeader title="封鎖的商家" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <YStack padding="$4" gap="$3">
          {isLoading && !refreshing && blockedMerchants.length === 0 ? (
            <View padding="$4" alignItems="center">
              <Spinner size="large" />
              <Text marginTop="$2" color="$gray10">載入中...</Text>
            </View>
          ) : blockedMerchants.length === 0 ? (
            <Card padding="$4" backgroundColor="$background">
              <YStack alignItems="center" gap="$2">
                <Text fontSize="$5" fontWeight="600">沒有封鎖的商家</Text>
                <Text fontSize="$3" color="$gray10" textAlign="center">
                  當您封鎖商家時，他們的優惠券將不會出現在您的動態中
                </Text>
              </YStack>
            </Card>
          ) : (
            blockedMerchants.map((blocked) => (
              <Card key={blocked.id} padding="$3" backgroundColor="$background">
                <XStack justifyContent="space-between" alignItems="center" gap="$3">
                  <YStack flex={1}>
                    <Text fontSize="$5" fontWeight="600">
                      {blocked.store.name}
                    </Text>
                    <Text fontSize="$2" color="$gray10" marginTop="$1">
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
    </Container>
  );
}

