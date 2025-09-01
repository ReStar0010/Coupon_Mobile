import React, { useState, useCallback } from 'react';
import { ActivityIndicator, RefreshControl } from 'react-native';
import { useRequireAuth } from '../utils/authAPI';
import { useRouter } from 'expo-router';
import { useStatisticsData } from './hooks/useStatisticsData';
import { useTransactionHistory } from './hooks/useTransactionHistory';
import { useAuthCheck } from './hooks/useAuthCheck';
import { AlignJustify } from 'lucide-react-native';
import GoalCard from './components/GoalCard';
import StatCard from './components/StatCard';
import ListItem from './components/ListItem';
import GoalModal from './components/GoalModal';
import Toast from './components/Toast';
import { XStack, YStack, H4, Button, ScrollView, View, Text } from 'tamagui';

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
}

const Statistics_new: React.FC = () => {
  // Authentication hooks
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  useAuthCheck(isAuthenticated, authLoading);

  // Statistics data hook
  const { stats, completedGoals, isLoading, error, setSavingsGoal, resetGoal, fetchUserStats } =
  useStatisticsData(isAuthenticated);  

  // Transaction history hook
  const { 
    transactionHistory, 
    isLoading: historyLoading, 
    error: historyError,
    formatDate,
    refetch: refetchHistory
  } = useTransactionHistory(isAuthenticated, 2);

  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const defaultImage = '/Info.png'; // Default image URL
  const router = useRouter();

  
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
    router.push('/Statistics_new/History');
  };

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh both statistics and transaction history
      await Promise.all([
        fetchUserStats?.(),
        refetchHistory?.()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchUserStats, refetchHistory]);

  // Show loading indicator while authentication or initial data is loading
  if (authLoading || isLoading) {
    return (
      <View flex={1} bg="#f5f5f5" items="center" style={{ justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text mt="$4" fontSize={16} color="#707070">載入中...</Text>
      </View>
    );
  }

  // Show error state if there's an error loading statistics
  if (error) {
    return (
      <View flex={1} bg="#f5f5f5" items="center" style={{ justifyContent: 'center' }}>
        <Text fontSize={16} color="#ef4444" style={{ textAlign: 'center' }} px="$5">
          {error}
        </Text>
        <Text mt="$2" fontSize={14} color="#707070">請稍後再試</Text>
      </View>
    );
  }

  return (
    <View flex={1} bg="#f5f5f5">
      {/* Header */}
      <XStack 
        items="center" 
        style={{ justifyContent: 'space-between' }}
        px="$5" 
        pt="$8"
      >
        <XStack gap="$3" items="center">
          <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
            成就列表
          </H4>
        </XStack>
        <Button 
          unstyled 
          onPress={() => {router.push('OptionsMenu')}}
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
            colors={["#FFAD31"]}
          />
        }
      >
        {/* Goal Card */}
        <GoalCard
          stats={stats}
          onSetGoal={openModal}
        />

        {/* List Items */}
        <YStack mt="$3">
          <YStack 
            rounded="$2" 
            style={{ borderWidth: 1, borderColor: 'white' }} 
            bg="#f5f5f5"
          >
            {historyLoading ? (
              <YStack p="$4" items="center">
                <Text fontSize={14} color="#707070">載入中...</Text>
              </YStack>
            ) : historyError ? (
              <YStack p="$4" items="center">
                <Text fontSize={14} color="#707070">載入失敗</Text>
              </YStack>
            ) : transactionHistory.length > 0 ? (
              <>
                {transactionHistory.map((item, index) => (
                  <ListItem
                    key={item.redemption_id}
                    store={item.store_name}
                    date={formatDate(item.used_date)}
                    isLast={index === transactionHistory.length - 1}
                  />
                ))}
                <ListItem
                  store="使用紀錄"
                  icon="list"
                  hasChevron
                  isLast={true}
                  onPress={handleViewHistory}
                />
              </>
            ) : (
              <>
                <YStack p="$4" items="center">
                  <Text fontSize={14} color="#707070">尚無使用紀錄</Text>
                </YStack>
                <ListItem
                  store="使用紀錄"
                  icon="list"
                  hasChevron
                  isLast={true}
                  onPress={handleViewHistory}
                />
              </>
            )}
          </YStack>
        </YStack>

        {/* Statistics Cards */}
        <XStack mt="$3" gap="$3">
          <StatCard
            title="酷胖使用張數"
            value={stats.couponsUsedCount.toString()}
          />
          <StatCard
            title="節省總金額 (元)"
            value={stats.totalSavings.toString()}
          />
        </XStack>
      </ScrollView> 

      {/* Goal Modal */}
      <GoalModal
        visible={isModalVisible}
        onClose={closeModal}
        onSave={handleSetGoal}
      />

      {/* Toast */}
      <Toast
        visible={showToast}
        message="目標設定成功"
        onHide={() => setShowToast(false)}
      />
    </View>
  );
};

export default Statistics_new;
