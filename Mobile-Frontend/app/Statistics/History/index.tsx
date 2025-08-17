import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Image,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRequireAuth, fetchAPI } from '../../utils/authAPI';
import { useToast } from '../../components/providers/ToastProvider';

type CouponHistoryItem = {
  coupon_id: number;
  store_name: string;
  coupon_name?: string;
  coupon_detail?: string;
  used_date: string;
  estimated_savings?: number;
};

const CouponHistory: React.FC = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  // State for coupon history
  const [history, setHistory] = useState<CouponHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onGoBackClick = useCallback(() => {
    router.push('/Statistics');
  }, [router]);

  const onHistoryItemClick = useCallback(
    async (item: CouponHistoryItem) => {
      try {
        // Store the selected coupon in AsyncStorage to access it from the details page
        await AsyncStorage.setItem('selectedCouponHistory', JSON.stringify(item));
        // Set navigation source to 'history' so the back button returns to the History page
        await AsyncStorage.setItem('couponNavigationSource', 'history');
        router.push(`/Statistics/History/${item.coupon_id}`);
      } catch (error) {
        console.error('Error storing coupon history:', error);
        showToast('無法開啟詳細資訊', 'error');
      }
    },
    [router, showToast]
  );

  // Fetch coupon history
  const fetchCouponHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchAPI('/coupon-history/', {
        method: 'GET',
      });

      setHistory(response.data.history || []);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching coupon history:', err);
      setError('無法載入優惠券使用紀錄，請稍後再試。');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCouponHistory();
    }
  }, [isAuthenticated]);

  // Show loading indicator while authentication is in progress
  if (authLoading) {
    return (
      <SafeAreaView className="bg-bg-grey flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text className="mt-4 text-lg text-gray-500">載入中...</Text>
      </SafeAreaView>
    );
  }

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

  const renderHistoryItem = ({ item, index }: { item: CouponHistoryItem; index: number }) => (
    <View>
      <TouchableOpacity
        className="flex shrink-0 flex-col items-start justify-start gap-2 self-stretch"
        onPress={() => onHistoryItemClick(item)}
        activeOpacity={0.7}>
        <View className="flex flex-row items-start justify-between gap-5 self-stretch">
          <View className="flex flex-col items-start justify-start">
            <Text
              className="text-sec-black font-jost text-base"
              style={{
                letterSpacing: -0.01,
                lineHeight: 24,
              }}>
              {item.store_name}
            </Text>
            <Text
              className="font-jost text-xs text-gray-500"
              style={{
                letterSpacing: -0.01,
                lineHeight: 18,
              }}>
              {formatDate(item.used_date)}
            </Text>
          </View>
          <View className="flex flex-col items-start justify-start px-0 pb-0 pt-2">
            <Image
              className="relative h-5 w-5 object-cover"
              style={{ width: 20, height: 20 }}
              source={require('../../../assets/forward-1.png')}
            />
          </View>
        </View>
      </TouchableOpacity>
      {index < history.length - 1 && <View className="bg-mid my-3 h-px w-full" />}
    </View>
  );

  return (
    <SafeAreaView className="bg-bg-grey flex-1">
      <View className="flex-1 gap-[30px] pl-1 pr-0 pt-[35px]">
        <View className="flex flex-col items-end justify-start gap-[35px] self-stretch py-0 pl-0 pr-[31px]">
          <View className="flex flex-col items-start justify-start gap-[22px] self-stretch pb-[5px] pl-[27px] pr-0 pt-0">
            <TouchableOpacity
              className="flex flex-row items-start justify-start gap-[9px]"
              onPress={onGoBackClick}
              activeOpacity={0.7}>
              <View className="flex flex-col items-start justify-start px-0 pb-0 pt-[4.5px]">
                <Image
                  className="relative h-[15px] w-[15px] object-contain"
                  style={{ width: 15, height: 15 }}
                  source={require('../../../assets/forward.png')}
                />
              </View>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  letterSpacing: -0.01,
                  lineHeight: 24,
                }}>
                返回
              </Text>
            </TouchableOpacity>

            <View className="flex flex-col items-start justify-start gap-[29px] self-stretch">
              <Text
                className="text-sec-black font-jost text-[32px] font-bold"
                style={{
                  letterSpacing: -0.01,
                  lineHeight: 48,
                }}>
                使用紀錄
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View className="flex w-full justify-center py-8">
              <ActivityIndicator size="large" color="#FFAD31" />
              <Text className="mt-2 text-lg text-gray-500">載入中...</Text>
            </View>
          ) : error ? (
            <View className="flex w-full justify-center py-8">
              <Text className="text-center text-red-500">{error}</Text>
            </View>
          ) : (
            <View className="bg-bg-white ml-[27px] box-border flex flex-col items-start justify-start self-stretch rounded-xl pb-[25px] pl-[27px] pr-[27px] pt-[25px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)]">
              {history.length > 0 ? (
                <FlatList
                  data={history}
                  renderItem={renderHistoryItem}
                  keyExtractor={(item, index) => `${item.coupon_id}-${index}`}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ flexGrow: 1 }}
                />
              ) : (
                <View className="self-center py-8">
                  <Text className="text-center text-gray-500">尚無使用紀錄</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default CouponHistory;
