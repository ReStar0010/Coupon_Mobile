import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Calendar, MapPin, Clock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRequireAuth } from '../../../utils/authAPI';
import { useAuthCheck } from '../../hooks/useAuthCheck';
import { XStack, YStack, H4, Button, ScrollView, View, Text } from 'tamagui';

interface CouponDetail {
  redemption_id: number;
  coupon_id: number;
  store_name: string;
  used_date: string;
  coupon_title?: string;
  discount_amount?: number;
  original_price?: number;
  final_price?: number;
}

const CouponHistoryDetail: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  // Authentication hooks
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  useAuthCheck(isAuthenticated, authLoading);

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
        weekday: date.toLocaleDateString('zh-TW', { weekday: 'long' })
      };
    } catch (e) {
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
        <Text mt="$4" fontSize={16} color="#707070">載入中...</Text>
      </View>
    );
  }

  // Show error state
  if (error || !couponDetail) {
    return (
      <View flex={1} bg="#f5f5f5">
        {/* Header */}
        <XStack 
          items="center" 
          px="$5" 
          pt="$8"
          pb="$4"
        >
          <Button 
            unstyled 
            onPress={handleGoBack}
            p="$0"
            mr="$3"
          >
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

  return (
    <View flex={1} bg="#f5f5f5">
      {/* Header */}
      <XStack 
        items="center" 
        px="$5" 
        pt="$8"
        pb="$4"
      >
        <Button 
          unstyled 
          onPress={handleGoBack}
          p="$0"
          mr="$3"
        >
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
              {couponDetail.coupon_title && (
                <Text fontSize={16} color="#707070" style={{ textAlign: 'center' }}>
                  {couponDetail.coupon_title}
                </Text>
              )}
            </YStack>

            {/* Savings Info */}
            {couponDetail.discount_amount && (
              <YStack items="center" p="$3" bg="#f0f9ff" rounded="$3">
                <Text fontSize={14} color="#0369a1">您節省了</Text>
                <Text fontSize={32} fontWeight="bold" color="#0369a1">
                  ${couponDetail.discount_amount}
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
            <Text fontSize={18} fontWeight="bold" color="#333333">使用詳情</Text>
            
            {/* Date */}
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
                <Text fontSize={14} color="#707070">交易編號</Text>
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
              <Text fontSize={18} fontWeight="bold" color="#333333">價格明細</Text>
              
              {couponDetail.original_price && (
                <XStack style={{ justifyContent: 'space-between' }}>
                  <Text fontSize={16} color="#707070">原價</Text>
                  <Text fontSize={16} color="#707070" style={{ textDecorationLine: 'line-through' }}>
                    ${couponDetail.original_price}
                  </Text>
                </XStack>
              )}
              
              {couponDetail.discount_amount && (
                <XStack style={{ justifyContent: 'space-between' }}>
                  <Text fontSize={16} color="#16a34a">優惠折扣</Text>
                  <Text fontSize={16} color="#16a34a">
                    -${couponDetail.discount_amount}
                  </Text>
                </XStack>
              )}
              
              {couponDetail.final_price && (
                <>
                  <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 8 }} />
                  <XStack style={{ justifyContent: 'space-between' }}>
                    <Text fontSize={18} fontWeight="bold" color="#333333">實付金額</Text>
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
