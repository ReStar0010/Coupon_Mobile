import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Clock,
  Tag,
  FileText,
  CalendarCheck,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRequireAuth } from '@/app/utils/authAPI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack, H4, Button, ScrollView, View, Text } from 'tamagui';

interface CouponDetail {
  redemption_id: number;
  coupon_id: number;
  store_name: string;
  used_date: string;
  coupon_name?: string;
  coupon_detail?: string;
  estimated_savings?: number;
  expiry_date?: string;
  /** @deprecated Use coupon_name */
  coupon_title?: string;
  /** @deprecated Use estimated_savings */
  discount_amount?: number;
  original_price?: number;
  final_price?: number;
}

const CouponHistoryDetail: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // Authentication - useRequireAuth handles auth check and redirect
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  const [couponDetail, setCouponDetail] = useState<CouponDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle back navigation
  const handleGoBack = () => {
    router.back();
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return {
        date: `${date.getFullYear()}年${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`,
        time: `${date
          .getHours()
          .toString()
          .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
        weekday: date.toLocaleDateString('zh-TW', { weekday: 'long' }),
      };
    } catch {
      return { date: dateString, time: '', weekday: '' };
    }
  };

  // Fetch coupon detail
  useEffect(() => {
    const loadCouponDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get data from AsyncStorage
        const storedData = await AsyncStorage.getItem('selectedCouponHistory');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          setCouponDetail(parsedData);
          setIsLoading(false);
        } else {
          // If no stored data, show error
          setError('無法載入優惠券詳情');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading coupon detail:', err);
        setError('無法載入優惠券詳情');
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      loadCouponDetail();
    }
  }, [id, isAuthenticated]);

  // Show loading indicator while authentication is in progress
  if (authLoading || isLoading) {
    return (
      <View flex={1} bg="#f5f5f5" items="center" style={{ justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text mt="$4" fontSize={16} color="#707070">
          載入中...
        </Text>
      </View>
    );
  }

  // Show error state
  if (error || !couponDetail) {
    return (
      <View flex={1} bg="#f5f5f5">
        {/* Header */}
        <XStack items="center" px="$5" pt={insets.top + 10} pb="$4">
          <Button unstyled onPress={handleGoBack} p="$0" mr="$3">
            <ChevronLeft size={24} color="#333333" />
          </Button>
          <H4 fontSize={20} color={'$black1'} fontWeight={'bold'}>
            使用詳情
          </H4>
        </XStack>

        <View flex={1} items="center" style={{ justifyContent: 'center' }}>
          <Text fontSize={16} color="#ef4444" style={{ textAlign: 'center' }} px="$5">
            {error || '找不到優惠券詳情'}
          </Text>
        </View>
      </View>
    );
  }

  const formattedDate = formatDate(couponDetail.used_date);
  const couponName = couponDetail.coupon_name ?? couponDetail.coupon_title;
  const savingsAmount = couponDetail.estimated_savings ?? couponDetail.discount_amount;

  const formatExpiryDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${date.getFullYear()}年${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
    } catch {
      return dateString;
    }
  };

  return (
    <View flex={1} bg="#f5f5f5">
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <XStack items="center" px="$5" pt={insets.top + 10} pb="$4">
        <Button unstyled onPress={handleGoBack} p="$0" mr="$3">
          <ChevronLeft size={24} color="#333333" />
        </Button>
        <H4 fontSize={20} color={'$black1'} fontWeight={'bold'}>
          使用詳情
        </H4>
      </XStack>

      {/* Content */}
      <ScrollView flex={1} px="$5" showsVerticalScrollIndicator={false}>
        {/* Main Info Card */}
        <YStack
          p="$4"
          mb="$4"
          bg="white"
          rounded="$3"
          style={{ borderWidth: 1, borderColor: '#e5e7eb' }}
          elevation="$1"
        >
          <YStack gap="$3">
            {/* Store Name */}
            <YStack items="center" gap="$2">
              <Text fontSize={24} fontWeight="bold" color="#333333" style={{ textAlign: 'center' }}>
                {couponDetail.store_name}
              </Text>
              {couponName && (
                <Text fontSize={16} color="#707070" style={{ textAlign: 'center' }}>
                  {couponName}
                </Text>
              )}
            </YStack>

            {/* Savings Info */}
            {savingsAmount != null && savingsAmount !== '' && (
              <YStack items="center" p="$3" bg="#f0f9ff" rounded="$3">
                <Text fontSize={14} color="#0369a1">
                  您節省了
                </Text>
                <Text fontSize={32} fontWeight="bold" color="#0369a1">
                  ${Number(savingsAmount)}
                </Text>
              </YStack>
            )}
          </YStack>
        </YStack>

        {/* Details Card */}
        <YStack
          p="$4"
          mb="$4"
          bg="white"
          rounded="$3"
          style={{ borderWidth: 1, borderColor: '#e5e7eb' }}
        >
          <YStack gap="$4">
            <Text fontSize={18} fontWeight="bold" color="#333333">
              使用詳情
            </Text>

            {/* Coupon Name */}
            {couponName && (
              <XStack items="center" gap="$3">
                <Tag size={20} color="#707070" />
                <YStack flex={1}>
                  <Text fontSize={14} color="#707070">
                    優惠名稱
                  </Text>
                  <Text fontSize={16} color="#333333">
                    {couponName}
                  </Text>
                </YStack>
              </XStack>
            )}

            {/* Coupon Detail */}
            {couponDetail.coupon_detail && (
              <XStack items="flex-start" gap="$3">
                <FileText size={20} color="#707070" style={{ marginTop: 2 }} />
                <YStack flex={1}>
                  <Text fontSize={14} color="#707070">
                    優惠內容
                  </Text>
                  <Text fontSize={16} color="#333333">
                    {couponDetail.coupon_detail}
                  </Text>
                </YStack>
              </XStack>
            )}

            {/* Date of use */}
            <XStack items="center" gap="$3">
              <Calendar size={20} color="#707070" />
              <YStack>
                <Text fontSize={16} color="#333333">
                  {formattedDate.date} ({formattedDate.weekday})
                </Text>
                <Text fontSize={14} color="#707070">
                  {formattedDate.time}
                </Text>
              </YStack>
            </XStack>

            {/* Coupon expiry */}
            {couponDetail.expiry_date && (
              <XStack items="center" gap="$3">
                <CalendarCheck size={20} color="#707070" />
                <YStack>
                  <Text fontSize={14} color="#707070">
                    優惠券到期日
                  </Text>
                  <Text fontSize={16} color="#333333">
                    {formatExpiryDate(couponDetail.expiry_date)}
                  </Text>
                </YStack>
              </XStack>
            )}

            {/* Store */}
            <XStack items="center" gap="$3">
              <MapPin size={20} color="#707070" />
              <Text fontSize={16} color="#333333">
                {couponDetail.store_name}
              </Text>
            </XStack>

            {/* Transaction ID */}
            <XStack items="center" gap="$3">
              <Clock size={20} color="#707070" />
              <YStack>
                <Text fontSize={14} color="#707070">
                  交易編號
                </Text>
                <Text fontSize={16} color="#333333">
                  #{couponDetail.redemption_id}
                </Text>
              </YStack>
            </XStack>
          </YStack>
        </YStack>

        {/* Price Breakdown Card */}
        {(couponDetail.original_price || couponDetail.final_price) && (
          <YStack
            p="$4"
            mb="$8"
            bg="white"
            rounded="$3"
            style={{ borderWidth: 1, borderColor: '#e5e7eb' }}
          >
            <YStack gap="$3">
              <Text fontSize={18} fontWeight="bold" color="#333333">
                價格明細
              </Text>

              {couponDetail.original_price && (
                <XStack style={{ justifyContent: 'space-between' }}>
                  <Text fontSize={16} color="#707070">
                    原價
                  </Text>
                  <Text
                    fontSize={16}
                    color="#707070"
                    style={{ textDecorationLine: 'line-through' }}
                  >
                    ${couponDetail.original_price}
                  </Text>
                </XStack>
              )}

              {savingsAmount != null && savingsAmount !== '' && (
                <XStack style={{ justifyContent: 'space-between' }}>
                  <Text fontSize={16} color="#16a34a">
                    優惠折扣
                  </Text>
                  <Text fontSize={16} color="#16a34a">
                    -${Number(savingsAmount)}
                  </Text>
                </XStack>
              )}

              {couponDetail.final_price && (
                <>
                  <View
                    style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 8 }}
                  />
                  <XStack style={{ justifyContent: 'space-between' }}>
                    <Text fontSize={18} fontWeight="bold" color="#333333">
                      實付金額
                    </Text>
                    <Text fontSize={18} fontWeight="bold" color="#333333">
                      ${couponDetail.final_price}
                    </Text>
                  </XStack>
                </>
              )}
            </YStack>
          </YStack>
        )}
      </ScrollView>
    </View>
  );
};

export default CouponHistoryDetail;
