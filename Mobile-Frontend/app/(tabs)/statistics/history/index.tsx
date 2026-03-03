import React, { useState, useCallback } from 'react';
import * as Sentry from '@sentry/react-native';
import { ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRequireAuth } from '@/app/utils/authAPI';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack, H4, Button, ScrollView, View, Text, ListItem, Separator } from 'tamagui';

const HistoryPage: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Authentication - useRequireAuth handles auth check and redirect
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  // Transaction history hook - fetch all history (no limit)
  const { transactionHistory, isLoading, error, formatDate, refetch } = useTransactionHistory(
    isAuthenticated,
    0,
  ); // 0 means no limit

  const [refreshing, setRefreshing] = useState(false);

  // Handle back navigation
  const handleGoBack = () => {
    router.back();
  };

  // Handle clicking on a history item
  const handleHistoryItemClick = useCallback(
    async (couponId: number, item: any) => {
      try {
        // Store the item data in AsyncStorage for use in detail page
        await AsyncStorage.setItem('selectedCouponHistory', JSON.stringify(item));
        // Set navigation source to 'statistics' so the back button returns to Statistics page
        await AsyncStorage.setItem('couponNavigationSource', 'statistics');
        router.push(`/statistics/history/${couponId}`);
      } catch (error) {
        console.error('Error storing coupon history:', error);
        Sentry.captureException(error, { data: { context: 'history.saveCouponHistory' } });
      }
    },
    [router],
  );

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch?.();
    } catch (error) {
      console.error('Error refreshing history:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Show loading indicator while authentication is in progress
  if (authLoading) {
    return (
      <View flex={1} bg="#f5f5f5" items="center" style={{ justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text mt="$4" fontSize={16} color="#707070">
          載入中...
        </Text>
      </View>
    );
  }

  return (
    <View flex={1} bg="#f5f5f5">
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <XStack
        items="center"
        style={{ justifyContent: 'space-between' }}
        px="$5"
        pt={insets.top + 10}
        pb="$4"
      >
        <XStack gap="$3" items="center">
          <Button unstyled onPress={handleGoBack} p="$0">
            <ChevronLeft size={24} color="#333333" />
          </Button>
          <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
            使用紀錄
          </H4>
        </XStack>
      </XStack>

      {/* Content */}
      <ScrollView
        flex={1}
        px="$5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FFAD31']}
            tintColor="#FFAD31"
          />
        }
      >
        <YStack rounded="$2" style={{ borderWidth: 1, borderColor: 'white' }} bg="#f5f5f5" mb="$8">
          {isLoading ? (
            <YStack p="$6" items="center">
              <ActivityIndicator size="large" color="#FFAD31" />
              <Text mt="$4" fontSize={16} color="#707070">
                載入中...
              </Text>
            </YStack>
          ) : error ? (
            <YStack p="$6" items="center">
              <Text fontSize={16} color="#ef4444" style={{ textAlign: 'center' }}>
                載入失敗
              </Text>
              <Text mt="$2" fontSize={14} color="#707070">
                請下拉重新整理
              </Text>
            </YStack>
          ) : transactionHistory.length > 0 ? (
            <YStack bg="white" rounded="$4" overflow="hidden" borderWidth={1} borderColor="#e0e0e0">
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
                    <ChevronRight size={16} color="#333333" />
                  </ListItem>
                  {index < transactionHistory.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </YStack>
          ) : (
            <YStack p="$6" items="center">
              <Text fontSize={16} color="#707070" style={{ textAlign: 'center' }}>
                尚無使用紀錄
              </Text>
              <Text mt="$2" fontSize={14} color="#9ca3af">
                開始使用優惠券來建立您的使用紀錄吧！
              </Text>
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </View>
  );
};

export default HistoryPage;
