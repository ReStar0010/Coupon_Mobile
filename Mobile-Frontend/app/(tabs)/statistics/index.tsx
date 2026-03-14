import React, { useState, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { useRequireAuth } from '@/app/utils/authAPI';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlignJustify } from 'lucide-react-native';
import { useProgressTrackers } from './hooks/useProgressTrackers';
import StatCard from './components/StatCard';
import LightSystem from './components/LightSystem';
import {
  XStack,
  YStack,
  H4,
  Button,
  ScrollView,
  View,
  Text,
  Spinner,
} from 'tamagui';

const Statistics: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const { data, loading, error, refetch } = useProgressTrackers();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch {
      // silently ignore
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      {authLoading ? (
        <View flex={1} bg="#f5f5f5" items="center" style={{ justifyContent: 'center' }}>
          <Spinner size="large" color="#FFAD31" />
          <Text mt="$4" fontSize={16} color="#707070">
            驗證身份中...
          </Text>
        </View>
      ) : (
        <View flex={1} bg="#f5f5f5">
          {/* Header */}
          <XStack
            items="center"
            style={{ justifyContent: 'space-between' }}
            px="$5"
            pt={insets.top + 10}
          >
            <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
              進度追蹤
            </H4>
            <Button
              unstyled
              onPress={() => {
                router.push('/options-menu');
              }}
            >
              <AlignJustify size={24} color="#333333" />
            </Button>
          </XStack>

          <ScrollView
            flex={1}
            px="$5"
            pt="$3"
            pb="$20"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFAD31"
                colors={['#FFAD31']}
              />
            }
          >
            {error ? (
              <YStack
                bg="white"
                rounded="$4"
                p="$6"
                items="center"
                borderWidth={1}
                borderColor="#e0e0e0"
                mt="$4"
              >
                <Text fontSize={16} color="#ef4444" style={{ textAlign: 'center' }}>
                  {error}
                </Text>
                <Text mt="$2" fontSize={14} color="#707070">
                  請稍後再試
                </Text>
              </YStack>
            ) : loading && !data ? (
              <YStack
                bg="white"
                rounded="$4"
                p="$6"
                items="center"
                borderWidth={1}
                borderColor="#e0e0e0"
                mt="$4"
              >
                <Spinner size="large" color="#FFAD31" />
                <Text mt="$4" fontSize={16} color="#707070">
                  載入中...
                </Text>
              </YStack>
            ) : data ? (
              <YStack gap="$4" mt="$2">
                {/* Metric 1 — Total redemption count */}
                <StatCard
                  title="總兌換次數"
                  value={data.total_redemptions.toString()}
                />

                {/* Metric 2 — Sharing light system */}
                <LightSystem
                  title="分享進度"
                  description="分享或兌換他人的專屬優惠券以點亮燈泡，每達 3 個點亮可獲 $10 現金券"
                  count={data.sharing_progress.count}
                  threshold={data.sharing_progress.threshold}
                  rewardType="sharing"
                />

                {/* Metric 3 — New user referral light system */}
                <LightSystem
                  title="推薦新用戶"
                  description="邀請新用戶完成首次兌換，第 1 位獲 $5 現金券，之後每位獲 $10 現金券"
                  count={data.referral_progress.count}
                  threshold={data.referral_progress.threshold}
                  rewardType="referral"
                />
              </YStack>
            ) : null}
          </ScrollView>
        </View>
      )}
    </>
  );
};

export default Statistics;
