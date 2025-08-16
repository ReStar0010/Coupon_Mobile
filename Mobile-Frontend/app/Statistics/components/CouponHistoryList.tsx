import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAPI } from '../../utils/authAPI';
import HistoryListElement from './HistoryListElement';

export type HistoryItem = {
  redemption_id: number;
  coupon_id: number;
  store_name: string;
  used_date: string;
};

export type CouponHistoryListType = {
  className?: string;
};

const CouponHistoryList: React.FC<CouponHistoryListType> = ({ className = '' }) => {
  const router = useRouter();
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const onViewMoreClick = useCallback(() => {
    router.push('/Statistics/History');
  }, [router]);

  // Handler for clicking on a history item
  const onHistoryItemClick = useCallback(
    async (couponId: number, item: HistoryItem) => {
      try {
        // Store the item data in AsyncStorage for use in detail page
        await AsyncStorage.setItem('selectedCouponHistory', JSON.stringify(item));
        // Set navigation source to 'statistics' so the back button returns to Statistics page
        await AsyncStorage.setItem('couponNavigationSource', 'statistics');
        router.push(`/Statistics/History/${couponId}`);
      } catch (error) {
        console.error('Error storing coupon history:', error);
      }
    },
    [router]
  );

  // Fetch the latest 2 history items
  useEffect(() => {
    const fetchRecentHistory = async () => {
      try {
        setIsLoading(true);

        const response = await fetchAPI('/coupon-history/', {
          method: 'GET',
        });

        // Get the most recent 2 items
        const history = response.data.history || [];
        setRecentHistory(history.slice(0, 2));
      } catch (err) {
        console.error('Error fetching recent history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentHistory();
  }, []);

  // Helper function to format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${date.getFullYear()}/${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}, ${date
        .getHours()
        .toString()
        .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
      return dateString;
    }
  };

  const renderHistoryItem = ({ item, index }: { item: HistoryItem; index: number }) => (
    <HistoryListElement
      key={item.redemption_id}
      prop={item.store_name}
      separator={formatDate(item.used_date)}
      forward="/forward-1@2x.png"
      couponId={item.coupon_id}
      couponData={item}
      lastElement={index === recentHistory.length - 1}
      onItemClick={() => onHistoryItemClick(item.coupon_id, item)}
    />
  );

  return (
    <View
      className={`bg-bg-white self-stretch rounded-xl px-[27px] py-[25px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] ${className}`}>
      <View className="flex flex-1 flex-col items-start justify-start gap-3">
        {isLoading ? (
          <View className="w-full items-center py-2">
            <ActivityIndicator size="small" color="#FFAD31" />
            <Text className="mt-2 text-gray-500">載入中...</Text>
          </View>
        ) : recentHistory.length > 0 ? (
          <FlatList
            data={recentHistory}
            renderItem={renderHistoryItem}
            keyExtractor={(item) => item.redemption_id.toString()}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 12 }}
          />
        ) : (
          <View className="w-full items-center py-2">
            <Text className="text-gray-500">尚無使用紀錄</Text>
          </View>
        )}

        {/* View More Button */}
        <View className="self-stretch border-t border-gray-200 pt-3">
          <TouchableOpacity
            className="flex items-center justify-center py-2"
            onPress={onViewMoreClick}
            activeOpacity={0.7}>
            <Text className="text-primary-purple font-medium">查看更多</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default CouponHistoryList;
