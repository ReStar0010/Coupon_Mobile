import React, { useState, useCallback } from 'react';
import { ActivityIndicator, RefreshControl } from 'react-native';
import { useRequireAuth } from '@/app/utils/authAPI';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStatisticsData } from './hooks/useStatisticsData';
import { useTransactionHistory } from './hooks/useTransactionHistory';
import { AlignJustify, List, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StatisticsChart from './components/StatisticsChart';
import StatCard from './components/StatCard';
import GoalModal from './components/GoalModal';
import StatisticsToast from './components/StatisticsToast';
import ErrorBoundary from '../../components/ErrorBoundary';
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

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
}

const Statistics: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Authentication hooks
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  // Statistics data hook
  const { stats, completedGoals, isLoading, error, setSavingsGoal, resetGoal, fetchUserStats } =
    useStatisticsData(isAuthenticated);

  // Transaction history hook
  const {
    transactionHistory,
    isLoading: historyLoading,
    error: historyError,
    formatDate,
    refetch: refetchHistory,
  } = useTransactionHistory(isAuthenticated, 2);

  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const defaultImage = '/Info.png'; // Default image URL

  const handleSetGoal = (customGoalName: string, customGoalAmount: number) => {
    setSavingsGoal(customGoalName, customGoalAmount, defaultImage);

    setIsModalVisible(false);
    setShowToast(true);

    // Hide toast after 3 seconds
    setTimeout(() => setShowToast(false), 3000);
  };

  const openModal = () => {
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
  };

  const handleViewHistory = () => {
    router.push('/(tabs)/statistics/history');
  };

  // Handle clicking on a history item
  const handleHistoryItemClick = useCallback(
    async (couponId: number, item: any) => {
      try {
        // Store the item data in AsyncStorage for use in detail page
        await AsyncStorage.setItem('selectedCouponHistory', JSON.stringify(item));
        // Set navigation source to 'statistics' so the back button returns to Statistics page
        await AsyncStorage.setItem('couponNavigationSource', 'statistics');
        router.push(`/(tabs)/statistics/history/${couponId}`);
      } catch (error) {
        console.error('Error storing coupon history:', error);
      }
    },
    [router]
  );

  // Navigation handlers for TabsFooter
  const handleHomePress = () => {
    router.push('/(tabs)/easyuse');
  };

  const handleCollectionPress = () => {
    router.push('/(tabs)/collection');
  };

  const handleStatisticsPress = () => {
    // Already on Statistics page, do nothing or scroll to top
  };

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh both statistics and transaction history
      await Promise.all([fetchUserStats?.(), refetchHistory?.()]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchUserStats, refetchHistory]);

  return (
    <ErrorBoundary>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Show loading indicator only while authentication is loading */}
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
            pt={insets.top + 10}>
            <XStack gap="$3" items="center">
              <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
                成就列表
              </H4>
            </XStack>
            <Button
              unstyled
              onPress={() => {
                router.push('/options-menu');
              }}>
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
            }>
            {/* Show error state inline if there's an error */}
            {error ? (
              <YStack
                bg="white"
                rounded="$4"
                p="$6"
                items="center"
                borderWidth={1}
                borderColor="#e0e0e0"
                mt="$4">
                <Text fontSize={16} color="#ef4444" style={{ textAlign: 'center' }}>
                  {error}
                </Text>
                <Text mt="$2" fontSize={14} color="#707070">
                  請稍後再試
                </Text>
              </YStack>
            ) : isLoading ? (
              <YStack
                bg="white"
                rounded="$4"
                p="$6"
                items="center"
                borderWidth={1}
                borderColor="#e0e0e0"
                mt="$4">
                <Spinner size="large" color="#FFAD31" />
                <Text mt="$4" fontSize={16} color="#707070">
                  載入統計資料中...
                </Text>
              </YStack>
            ) : (
              <>
                {/* Statistics Chart */}
                <StatisticsChart
                  currentAmount={stats.totalSavings}
                  targetAmount={stats.savingsGoalAmount}
                  goalName={stats.savingsGoalName}
                  goalImage={stats.savingsGoalImage}
                  onSetGoal={openModal}
                />

                {/* Statistics Cards */}
                <XStack mt="$4" gap="$4">
                  <StatCard title="酷胖使用張數" value={stats.couponsUsedCount.toString()} />
                  <StatCard title="節省總金額 (元)" value={stats.totalSavings.toString()} />
                </XStack>
              </>
            )}

            {/* List Items */}
            <YStack mt="$3">
              {historyLoading ? (
                <YStack
                  bg="white"
                  rounded="$4"
                  p="$4"
                  items="center"
                  borderWidth={1}
                  borderColor="#e0e0e0">
                  <Text fontSize={14} color="#707070">
                    載入中...
                  </Text>
                </YStack>
              ) : historyError ? (
                <YStack
                  bg="white"
                  rounded="$4"
                  p="$4"
                  items="center"
                  borderWidth={1}
                  borderColor="#e0e0e0">
                  <Text fontSize={14} color="#707070">
                    載入失敗
                  </Text>
                </YStack>
              ) : transactionHistory.length > 0 ? (
                <YStack
                  bg="white"
                  rounded="$4"
                  overflow="hidden"
                  borderWidth={1}
                  borderColor="#e0e0e0">
                  {transactionHistory.map((item, index) => (
                    <React.Fragment key={item.redemption_id}>
                      <ListItem
                        bg="white"
                        hoverTheme
                        pressTheme
                        p="$3"
                        onPress={() => handleHistoryItemClick(item.coupon_id, item)}>
                        <ListItem.Text fontSize={13} color="#333333">
                          {item.store_name}
                        </ListItem.Text>
                        <ListItem.Subtitle fontSize={12} color="#707070">
                          {formatDate(item.used_date)}
                        </ListItem.Subtitle>
                        {item.estimated_savings != null && !Number.isNaN(item.estimated_savings) ? (
                          <Text fontSize={12} color="#22c55e" style={{ marginTop: 2 }}>
                            節省 {Number(item.estimated_savings)} 元
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
                    icon={<List size={20} color="#333333" />}>
                    <ListItem.Text fontSize={13} color="#333333">
                      使用紀錄
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
                  borderColor="#e0e0e0">
                  <YStack p="$4" items="center">
                    <Text fontSize={14} color="#707070">
                      尚無使用紀錄
                    </Text>
                  </YStack>
                  <Separator />
                  <ListItem
                    bg="white"
                    hoverTheme
                    pressTheme
                    p="$3"
                    onPress={handleViewHistory}
                    icon={<List size={20} color="#333333" />}>
                    <ListItem.Text fontSize={13} color="#333333">
                      使用紀錄
                    </ListItem.Text>
                    <ChevronRight size={16} color="#333333" />
                  </ListItem>
                </YStack>
              )}
            </YStack>
          </ScrollView>

          {/* Goal Modal */}
          <GoalModal visible={isModalVisible} onClose={closeModal} onSave={handleSetGoal} />

          {/* Toast */}
          <StatisticsToast
            visible={showToast}
            message="目標設定成功"
            onHide={() => setShowToast(false)}
          />
        </View>
      )}
    </ErrorBoundary>
  );
};

export default Statistics;
