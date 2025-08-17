import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAPI, useRequireAuth } from '../../../utils/authAPI';
import UserInfoElement from '../../../components/UserInfoElement';

type CouponHistoryDetail = {
  coupon_id: number;
  store_name: string;
  coupon_name: string;
  coupon_detail: string;
  used_date: string;
  estimated_savings: number;
};

const CouponHistoryDetail: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const [couponDetail, setCouponDetail] = useState<CouponHistoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('history');

  const onGoBackClick = useCallback(() => {
    // Navigate based on where the user came from
    if (source === 'statistics') {
      router.push('/Statistics');
    } else {
      router.push('/Statistics/History');
    }
  }, [router, source]);

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '無日期資料';
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

  // Format savings as currency
  const formatSavings = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return '無金額資料';
    return `NT$ ${amount.toFixed(0)}`;
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const couponId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    if (!couponId) {
      setError('找不到優惠券紀錄');
      setIsLoading(false);
      return;
    }

    const loadCouponDetail = async () => {
      try {
        // Check navigation source
        const navigationSource = await AsyncStorage.getItem('couponNavigationSource');
        if (navigationSource) {
          setSource(navigationSource);
          await AsyncStorage.removeItem('couponNavigationSource'); // Clear after use
        }

        // Try to get data from AsyncStorage first
        const storedData = await AsyncStorage.getItem('selectedCouponHistory');
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            if (parsedData.coupon_id.toString() === couponId) {
              setCouponDetail(parsedData);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.error('Error parsing stored coupon data:', e);
          }
        }

        // If not found in AsyncStorage or ID doesn't match, fetch from API
        await fetchCouponDetail(couponId);
      } catch (e) {
        console.error('Error loading coupon detail:', e);
        setError('載入優惠券詳細資料時發生錯誤');
        setIsLoading(false);
      }
    };

    loadCouponDetail();
  }, [isAuthenticated, params]);

  const fetchCouponDetail = async (couponId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchAPI(`/coupon-history/${couponId}/`, {
        method: 'GET',
      });

      if (response.data) {
        setCouponDetail(response.data);
      } else {
        setError('無法取得優惠券詳細資料');
      }
    } catch (err) {
      console.error('Error fetching coupon detail:', err);
      setError('載入優惠券詳細資料時發生錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading indicator while authentication is in progress
  if (authLoading) {
    return (
      <SafeAreaView className="bg-bg-grey flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text className="mt-4 text-lg text-gray-500">載入中...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-bg-grey flex-1">
      <ScrollView className="flex-1 gap-[30px] pb-7 pl-1 pr-0 pt-[35px]">
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
                  source={require('../../../../assets/forward.png')}
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
                優惠券詳情
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
          ) : couponDetail ? (
            <View className="bg-bg-white ml-[27px] box-border flex max-w-full flex-row items-start justify-start self-stretch rounded-xl pb-[29px] pl-[30px] pr-[29px] pt-[31px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)]">
              <View className="flex flex-1 flex-col items-start justify-start gap-4">
                <UserInfoElement
                  prop="商家"
                  content={couponDetail.store_name}
                  userIconsMinWidth={60}
                />
                <UserInfoElement
                  prop="優惠券"
                  content={couponDetail.coupon_name || '未提供名稱'}
                  userIconsMinWidth={60}
                />
                <UserInfoElement
                  prop="內容"
                  content={couponDetail.coupon_detail || '無詳細說明'}
                  userIconsMinWidth={60}
                />
                <UserInfoElement
                  prop="使用時間"
                  content={formatDate(couponDetail.used_date)}
                  userIconsMinWidth={60}
                />
                <UserInfoElement
                  prop="省下"
                  content={formatSavings(couponDetail.estimated_savings)}
                  userIconsMinWidth={60}
                  lastElement={true}
                />
              </View>
            </View>
          ) : (
            <View className="flex w-full justify-center py-8">
              <Text className="text-center text-red-500">找不到優惠券資料</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CouponHistoryDetail;
