import React, { useState, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRequireAuth } from '@/app/utils/authAPI';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlignJustify, List, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProgressTrackers } from './hooks/useProgressTrackers';
import { useTransactionHistory } from './hooks/useTransactionHistory';
import StatCard from './components/StatCard';
import GoalModal from './components/GoalModal';
import StatisticsToast from './components/StatisticsToast';
import * as Sentry from '@sentry/react-native';
import ScreenErrorFallback from '../../components/ScreenErrorFallback';
import LightSystem from './components/LightSystem';
import {
  XStack,
  YStack,
  H4,
  Button,
  ScrollView,
  View,
  Text,
  ListItem,
  Separator,
  Spinner,
} from 'tamagui';

const Statistics: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const { data, loading, error, refetch } = useProgressTrackers();
  const {
    transactionHistory,
    isLoading: historyLoading,
    error: historyError,
    formatDate,
    refetch: refetchHistory,
  } = useTransactionHistory(isAuthenticated, 2);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchHistory()]);
    } catch {
      // silently ignore
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchHistory]);

  const handleViewHistory = () => {
    router.push('/(tabs)/statistics/history');
  };

  const handleHistoryItemClick = useCallback(
    async (couponId: number, item: unknown) => {
      try {
        await AsyncStorage.setItem('selectedCouponHistory', JSON.stringify(item));
        await AsyncStorage.setItem('couponNavigationSource', 'statistics');
        router.push(`/(tabs)/statistics/history/${couponId}`);
      } catch (err) {
        console.error('Error storing coupon history:', err);
      }
    },
    [router],
  );

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, componentStack, resetError }) => (
        <ScreenErrorFallback
          error={error as Error}
          componentStack={componentStack}
          resetError={resetError}
        />
      )}
      beforeCapture={(scope) => {
        scope.setTag('boundary', 'statistics-screen');
        scope.setTag('boundary_type', 'screen');
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {authLoading ? (
        <View flex={1} bg="#f5f5f5" items="center" style={{ justifyContent: 'center' }}>
          <Spinner size="large" color="#FFAD31" />
          <Text mt="$4" fontSize={16} color="#707070">
            {t('statistics.verifyingAuth')}
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
              {t('statistics.progressTracker')}
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
            {/* Progress Trackers */}
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
                  {t('statistics.tryAgainLater')}
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
                  {t('statistics.loading')}
                </Text>
              </YStack>
            ) : data ? (
              <YStack gap="$4" mt="$2">
                {/* Metric 1 — Total redemption count */}
                <StatCard title={t('statistics.totalRedemptions')} value={data.total_redemptions.toString()} />

                {/* Metric 2 — Sharing light system */}
                <LightSystem
                  title={t('statistics.sharingProgress')}
                  description={t('statistics.sharingDescription')}
                  count={data.sharing_progress.count}
                  threshold={data.sharing_progress.threshold}
                  rewardType="sharing"
                  vouchersEarned={data.sharing_progress.vouchers_earned}
                />

                {/* Metric 3 — New user referral light system */}
                <LightSystem
                  title={t('statistics.referralProgress')}
                  description={t('statistics.referralDescription')}
                  count={data.referral_progress.count}
                  threshold={data.referral_progress.threshold}
                  rewardType="referral"
                />
              </YStack>
            ) : null}

            {/* Transaction History */}
            <YStack mt="$3">
              {historyLoading ? (
                <YStack
                  bg="white"
                  rounded="$4"
                  p="$4"
                  items="center"
                  borderWidth={1}
                  borderColor="#e0e0e0"
                >
                  <Text fontSize={14} color="#707070">
                    {t('statistics.loading')}
                  </Text>
                </YStack>
              ) : historyError ? (
                <YStack
                  bg="white"
                  rounded="$4"
                  p="$4"
                  items="center"
                  borderWidth={1}
                  borderColor="#e0e0e0"
                >
                  <Text fontSize={14} color="#707070">
                    {t('statistics.loadFailed')}
                  </Text>
                </YStack>
              ) : transactionHistory.length > 0 ? (
                <YStack
                  bg="white"
                  rounded="$4"
                  overflow="hidden"
                  borderWidth={1}
                  borderColor="#e0e0e0"
                >
                  {transactionHistory.map((item, index) => (
                    <React.Fragment key={item.redemption_id}>
                      <ListItem
                        bg="white"
                        hoverTheme
                        pressTheme
                        p="$3"
                        onPress={() => handleHistoryItemClick(item.coupon_id, item)}
                      >
                        <ListItem.Text fontSize={13} color="#333333">
                          {item.store_name}
                        </ListItem.Text>
                        <ListItem.Subtitle fontSize={12} color="#707070">
                          {formatDate(item.used_date)}
                        </ListItem.Subtitle>
                        {item.estimated_savings != null && !Number.isNaN(item.estimated_savings) ? (
                          <Text fontSize={12} color="#22c55e" style={{ marginTop: 2 }}>
                            {t('statistics.savingsAmount', { amount: Number(item.estimated_savings) })}
                          </Text>
                        ) : null}
                        <ChevronRight size={16} color="#333333" />
                      </ListItem>
                      {index < transactionHistory.length - 1 && <Separator />}
                    </React.Fragment>
                  ))}
                  <Separator />
                  <ListItem
                    bg="white"
                    hoverTheme
                    pressTheme
                    p="$3"
                    onPress={handleViewHistory}
                    icon={<List size={20} color="#333333" />}
                  >
                    <ListItem.Text fontSize={13} color="#333333">
                      {t('statistics.viewHistory')}
                    </ListItem.Text>
                    <ChevronRight size={16} color="#333333" />
                  </ListItem>
                </YStack>
              ) : (
                <YStack
                  bg="white"
                  rounded="$4"
                  overflow="hidden"
                  borderWidth={1}
                  borderColor="#e0e0e0"
                >
                  <YStack p="$4" items="center">
                    <Text fontSize={14} color="#707070">
                      {t('statistics.noHistoryYet')}
                    </Text>
                  </YStack>
                  <Separator />
                  <ListItem
                    bg="white"
                    hoverTheme
                    pressTheme
                    p="$3"
                    onPress={handleViewHistory}
                    icon={<List size={20} color="#333333" />}
                  >
                    <ListItem.Text fontSize={13} color="#333333">
                      {t('statistics.viewHistory')}
                    </ListItem.Text>
                    <ChevronRight size={16} color="#333333" />
                  </ListItem>
                </YStack>
              )}
            </YStack>
          </ScrollView>
        </View>
      )}
    </Sentry.ErrorBoundary>
  );
};

export default Statistics;
