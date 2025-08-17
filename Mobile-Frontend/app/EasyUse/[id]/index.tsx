import '../../../global.css';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import SuccessPopup from './redeem/SuccessPopup';
import { isUserLoggedIn, fetchAPI } from '../../utils/authAPI';
import { devLog } from '../../utils/devLogger';

export type CouponDetailType = {
  id: number;
  store_name: string;
  store_id: number;
  store_location: {
    lat: number;
    lng: number;
  };
  address: string;
  active_coupon_count: number;
  has_active_coupons: boolean;
  coupon_name: string;
  coupon_detail: string;
  important_notes?: string;
  start_date: string;
  expiry_date: string;
  coupon_type: 'store' | 'exclusive';
  last_holder_email?: string;
  is_redeemed: boolean;
  can_use_today: boolean;
};

const CouponDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const params = useLocalSearchParams();
  const sourceParam = params.source as string;

  const [coupon, setCoupon] = useState<CouponDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchCouponDetail = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetchAPI(`/coupons/${id}/`, {
            method: 'GET',
          });

          devLog('Fetched coupon details:', response.data);
          setCoupon(response.data);
        } catch (err) {
          console.error('Error fetching coupon details:', err);
          let errorMessage = '無法載入優惠券詳情。';
          if (err instanceof Error) {
            if (err.message.includes('404')) {
              errorMessage = '找不到此優惠券。';
            } else if (err.message.includes('401')) {
              errorMessage = '請先登入以查看此優惠券。';
            } else {
              errorMessage = `載入錯誤: ${err.message}`;
            }
          }
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchCouponDetail();
    } else {
      setError('無效的優惠券 ID。');
      setIsLoading(false);
    }
  }, [id]);

  const onGoBackContainerClick = useCallback(() => {
    // Navigate based on source parameter
    if (sourceParam === 'collection') {
      router.push('/Collection');
    } else {
      router.push('/EasyUse');
    }
  }, [router, sourceParam]);

  const onRedeemClick = async () => {
    if (coupon) {
      if (coupon.coupon_type === 'store') {
        // Check if the user is logged in before redeeming
        const userLoggedIn = await isUserLoggedIn();
        if (!userLoggedIn) {
          devLog('User not logged in. Redirecting to login page');
          const returnUrl = `/EasyUse/${coupon.id}`;
          router.push(`/Login?returnUrl=${encodeURIComponent(returnUrl)}`);
          return;
        }

        // For store coupons, redeem directly without a code
        try {
          setIsRedeeming(true);

          await fetchAPI(`/redeem/${coupon.id}/`, {
            method: 'POST',
          });

          // Update the coupon state to show it as redeemed
          setCoupon({ ...coupon, is_redeemed: true });
          // Show success popup instead of alert
          setShowSuccessPopup(true);
        } catch (err) {
          console.error('Error redeeming coupon:', err);
          let errorMessage = '兌換失敗，請稍後再試。';
          if (err instanceof Error) {
            errorMessage = err.message;
          }
          Alert.alert('兌換失敗', errorMessage);
          setIsRedeeming(false);
        }
      } else {
        // For exclusive coupons, navigate to the redemption page to enter code
        router.push(`/EasyUse/${coupon.id}/redeem`);
      }
    }
  };

  // Handler to close the success popup and redirect
  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);
    setIsRedeeming(false);
    router.push('/EasyUse'); // Redirect back to main page
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}\n${month}/${day}`;
    } catch (e) {
      return '無效日期';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="bg-bg-grey flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text className="text-sec-black mt-4 text-lg">載入中...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="bg-bg-grey flex-1 items-center justify-center px-4">
        <Text className="mb-4 text-center text-lg text-red-500">{error}</Text>
        <TouchableOpacity
          onPress={onGoBackContainerClick}
          className="rounded-lg bg-gray-300 px-4 py-2">
          <Text className="font-semibold text-gray-700">返回</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!coupon) {
    return (
      <SafeAreaView className="bg-bg-grey flex-1 items-center justify-center">
        <Text className="text-sec-black text-lg">找不到優惠券資料。</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-bg-grey flex-1">
      <ScrollView className="flex-1 px-8 pt-9">
        {/* Back Button */}
        <View className="mb-6 flex flex-col items-start justify-start gap-[22px]">
          <TouchableOpacity
            onPress={onGoBackContainerClick}
            className="flex flex-row items-center gap-[9px]"
            activeOpacity={0.7}>
            <View className="flex flex-col items-start justify-start pt-[4.5px]">
              <Image
                className="relative h-[15px] w-[15px]"
                style={{ width: 15, height: 15 }}
                source={require('../../../assets/forward.png')}
              />
            </View>
            <Text className="text-sec-black font-jost min-w-[32px] text-base leading-[150%] tracking-[-0.01em]">
              返回
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View className="flex-1 gap-[25px] pb-32">
          {/* Store Info Card */}
          <View className="bg-bg-white h-[208px] w-full items-center justify-center rounded-xl drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)]">
            <View className="flex w-full flex-col items-center justify-center gap-[10px] px-[10%]">
              <Text
                className="font-jost text-sec-black w-[80%] text-center text-3xl font-bold leading-tight tracking-[-0.43px]"
                numberOfLines={2}>
                {coupon.store_name}
              </Text>
              <Text
                className="font-jost text-sec-black w-[80%] text-center text-base font-bold leading-snug tracking-[-0.43px]"
                numberOfLines={2}>
                {coupon.coupon_name}
              </Text>
            </View>
          </View>

          {/* Info Cards Row */}
          <View className="w-full flex-row justify-between gap-[15px]">
            {/* Expiry Date Card */}
            <View className="bg-bg-white aspect-square w-[48%] items-center justify-center rounded-xl drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)]">
              <View className="flex w-full flex-col items-center justify-center gap-[10px] p-[10%]">
                <Text className="font-jost text-sec-black text-sm leading-[22px] tracking-[-0.43px]">
                  到期日期
                </Text>
                <Text className="font-jost text-sec-black text-center text-2xl font-bold leading-normal tracking-[-0.43px]">
                  {formatDate(coupon.expiry_date)}
                </Text>
              </View>
            </View>

            {/* Source Card */}
            <View className="bg-bg-white aspect-square w-[48%] items-center justify-center rounded-xl drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)]">
              <View className="flex w-full flex-col items-center justify-center gap-[10px] p-[10%]">
                <Text className="font-jost text-sec-black text-sm leading-[22px] tracking-[-0.43px]">
                  來自
                </Text>
                <Text
                  className="font-jost text-sec-black text-center text-lg text-xs font-bold leading-normal tracking-[-0.43px]"
                  numberOfLines={3}>
                  {coupon.coupon_type === 'store'
                    ? coupon.store_name
                    : coupon.coupon_type === 'exclusive' && coupon.last_holder_email
                      ? coupon.last_holder_email
                      : 'CouPro'}
                </Text>
              </View>
            </View>
          </View>

          {/* Detail Card */}
          <View className="bg-bg-white min-h-[256px] w-full items-center justify-center rounded-xl drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)]">
            <View className="my-[10%] flex w-[80%] flex-col items-start justify-center gap-[30px]">
              <Text className="font-jost text-sec-black text-left text-xl font-bold">
                {coupon.coupon_detail.split('\n').map((line, index) => (
                  <Text key={index}>
                    {line}
                    {index < coupon.coupon_detail.split('\n').length - 1 && '\n'}
                  </Text>
                ))}
              </Text>

              {coupon.important_notes && (
                <View>
                  <Text className="font-jost text-sec-black mb-4 text-lg font-bold">
                    注意事項：
                  </Text>
                  <Text className="font-jost text-sec-black text-base leading-6">
                    {coupon.important_notes.split(/\r?\n/).map((rawLine, index) => {
                      const line = rawLine.trim();
                      const match = line.match(/^(\d+)\.\s*(.*)$/);

                      if (!match) {
                        return (
                          <Text key={index} className="pl-8">
                            {line}
                            {'\n'}
                          </Text>
                        );
                      }

                      const [, number, text] = match;
                      return (
                        <Text key={index} className="mb-1">
                          {number}. {text}
                          {'\n'}
                        </Text>
                      );
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      {!coupon.is_redeemed && (
        <View className="absolute bottom-8 left-12 right-12">
          <TouchableOpacity
            onPress={isRedeeming || !coupon.can_use_today ? undefined : onRedeemClick}
            className={`bg-act-yellow h-20 items-center justify-center rounded-xl drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] ${
              isRedeeming || !coupon.can_use_today ? 'opacity-50' : ''
            }`}
            disabled={isRedeeming || !coupon.can_use_today}
            activeOpacity={0.8}>
            <Text className="font-jost text-sec-black text-[32px] font-bold leading-[22px] tracking-[-0.43px]">
              {isRedeeming
                ? '處理中...'
                : !coupon.can_use_today
                  ? '今日已使用'
                  : coupon.coupon_type === 'store'
                    ? '使用'
                    : '核銷'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {coupon.is_redeemed && coupon.coupon_type === 'exclusive' && (
        <View className="absolute bottom-8 left-12 right-12">
          <Text className="text-center text-lg text-red-500">此優惠券已被兌換</Text>
        </View>
      )}

      {/* Success Popup */}
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={handleCloseSuccessPopup}
        storeName={coupon?.store_name}
        couponDetail={coupon?.coupon_detail}
        titleType="使用成功"
      />
    </SafeAreaView>
  );
};

export default CouponDetailPage;
