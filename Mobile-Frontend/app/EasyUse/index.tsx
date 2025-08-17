import '../../global.css';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { fetchAPI } from '../utils/authAPI';
import PageHeader from '../components/PageHeader';
import MapComponent from '../components/MapComponent';

export type CouponType = {
  className?: string;
  id?: number;
  storeName: string;
  couponName: string;
  description: string;
  importantNotes?: string;
  startDate: Date;
  expiryDate: Date;
  couponType: 'store' | 'exclusive';
  sourceUser?: string;
  storeId?: number;
  storeLocation?: {
    lat: number;
    lng: number;
  };
  address?: string;
  active_coupon_count?: number;
  has_active_coupons?: boolean;
  imageUrl?: string;
};

interface Store {
  id: number;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  address?: string;
  active_coupon_count?: number;
  has_active_coupons?: boolean;
}

interface ApiCoupon {
  id: number;
  store_name: string;
  coupon_name: string;
  coupon_detail: string;
  important_notes?: string;
  start_date: string;
  expiry_date: string;
  coupon_type: 'store' | 'exclusive';
  source_user?: string;
  is_redeemed: boolean;
  store_id?: number;
  store_location?: {
    lat: number;
    lng: number;
  };
  address?: string;
  active_coupon_count?: number;
  has_active_coupons?: boolean;
  image_url?: string;
}

interface CouponProps {
  className?: string;
  description?: string;
  couponName?: string;
  storeName?: string;
  id?: number;
  imageUrl?: string;
}

const Coupon: React.FC<CouponProps> = ({
  className = '',
  description,
  couponName,
  storeName,
  id,
  imageUrl,
}) => {
  const router = useRouter();

  const onCouponClick = () => {
    if (id) {
      router.push(`/EasyUse/${id}`);
    } else {
      console.error('Coupon ID is undefined, cannot navigate.');
    }
  };

  return (
    <TouchableOpacity
      className="flex max-w-full shrink-0 flex-row items-start justify-start self-stretch drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)]"
      onPress={onCouponClick}
      activeOpacity={0.7}>
      <View className="relative box-border flex max-w-full flex-1 flex-row items-start justify-start px-2 pb-5 pt-[73px]">
        <View className="bg-bg-white absolute bottom-[0px] left-[0px] right-[0px] top-[0px] !m-[0] h-full w-full rounded-xl" />

        <Text className="font-jost text-sec-black absolute left-[119px] top-[32px] z-[2] text-xl font-bold leading-[22px] tracking-[-0.43px]">
          {storeName || '店家名稱'}
        </Text>

        <Text className="text-sec-black font-jost relative bottom-[5px] left-[111px] z-[1] w-[204px] text-xs leading-[23px] tracking-[-0.43px]">
          {couponName || '優惠詳情'}
        </Text>

        <View className="absolute left-[22px] top-[50%] z-[2] !m-[0] h-[70px] w-[70px] translate-y-[-50%]">
          <Image
            className="absolute bottom-[0%] left-[0%] right-[0%] top-[0%] h-full max-h-full w-full max-w-full overflow-hidden rounded-[8px] object-cover"
            style={{ width: 70, height: 70 }}
            source={{ uri: imageUrl || '/Info.png' }}
            defaultSource={require('../../assets/Info.png')} // 提供本地預設圖片
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const EasyUse = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [coupons, setCoupons] = useState<CouponType[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const searchParam = params.search as string;
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, []);

  // 拿優惠資料
  useEffect(() => {
    const fetchCoupons = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchAPI('/store-coupons/', {
          method: 'GET',
        });

        if (!Array.isArray(response.data)) {
          console.error('API response is not an array:', response.data);
          throw new Error('Unexpected API response format.');
        }

        const transformedCoupons = response.data.map((coupon: ApiCoupon) => ({
          id: coupon.id,
          storeName: coupon.store_name,
          couponName: coupon.coupon_name,
          description: coupon.coupon_detail,
          importantNotes: coupon.important_notes,
          startDate: new Date(coupon.start_date),
          expiryDate: new Date(coupon.expiry_date),
          couponType: coupon.coupon_type,
          sourceUser: coupon.source_user,
          storeId: coupon.store_id,
          storeLocation: coupon.store_location,
          address: coupon.address,
          active_coupon_count: coupon.active_coupon_count,
          has_active_coupons: coupon.has_active_coupons,
          imageUrl: coupon.image_url,
        }));
        setCoupons(transformedCoupons);

        // Process store information
        const storeDataMap = new Map<number, Store>();

        transformedCoupons.forEach((coupon) => {
          if (coupon.storeId && coupon.storeLocation) {
            if (!storeDataMap.has(coupon.storeId)) {
              storeDataMap.set(coupon.storeId, {
                id: coupon.storeId,
                name: coupon.storeName,
                location: coupon.storeLocation,
                address: coupon.address,
                active_coupon_count: coupon.active_coupon_count,
                has_active_coupons: coupon.has_active_coupons,
              });
            }
          }
        });

        const storeList = Array.from(storeDataMap.values());
        setStores(storeList);
      } catch (err) {
        console.error('Error fetching coupons:', err);
        let errorMessage = '無法載入優惠券，請稍後再試。';

        if (err instanceof Error) {
          if (err.message.includes('401')) {
            errorMessage = '請先登入或重新登入。';
          } else {
            errorMessage = `無法載入優惠券: ${err.message}`;
          }
        }

        setError(errorMessage);
        setCoupons([]);
        setStores([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoupons();
  }, [router]);

  const filteredCoupons = coupons.filter((coupon) => {
    return searchQuery
      ? coupon.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coupon.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
  });

  const setStoreSearch = useCallback((storeName: string) => {
    setSearchQuery(storeName);
  }, []);

  const onMenuIconClick = () => {
    // In React Native, we don't have sessionStorage, use AsyncStorage instead
    // For now, just navigate directly
    router.push('/OptionsMenu');
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <SafeAreaView className="bg-bg-grey flex-1">
      <ScrollView className="flex-1">
        <View className="flex w-full flex-col items-end justify-start gap-[10px] px-[11px] pt-[35px]">
          <PageHeader
            title="隨取即用"
            infoPopupTitle="什麼是隨取即用？"
            infoPopupContent={
              <View>
                <Text className="mb-2 text-xs text-gray-700">
                  「隨取即用」是 CouPro
                  上的基本優惠類型，由店家提供，平台整理後讓所有用戶都能更快速方便的得知優惠資訊並直接使用。
                </Text>
              </View>
            }
            navbarProps={{ atCollection: true }}
            sourcePage="/EasyUse"
          />

          {/* Map section */}
          <View className="box-border h-[300px] max-w-full shrink-0 self-stretch px-[19px] pb-2 pt-2">
            {isLoading ? (
              <View className="flex h-full w-full items-center justify-center rounded-xl bg-gray-100 p-4">
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text className="mt-4 text-lg text-gray-500">載入地圖中...</Text>
              </View>
            ) : error ? (
              <View className="flex h-full w-full items-center justify-center rounded-xl bg-gray-100 p-4">
                <Text className="text-center text-red-500">{error}</Text>
              </View>
            ) : (
              <MapComponent
                stores={stores}
                className="h-full w-full rounded-xl shadow-md"
                setStoreSearch={setStoreSearch}
              />
            )}
          </View>

          {/* Coupon list section */}
          <View className="box-border flex max-w-full flex-col gap-[15px] self-stretch px-[19px] pb-2 pt-2">
            {isLoading ? (
              <View className="flex w-full items-center justify-center p-4">
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text className="mt-4 text-lg text-gray-500">載入中...</Text>
              </View>
            ) : error ? (
              <View className="flex w-full items-center justify-center p-4">
                <Text className="text-center text-red-500">{error}</Text>
              </View>
            ) : filteredCoupons.length === 0 ? (
              <View className="flex w-full items-center justify-center p-4">
                <Text className="text-gray-500">目前沒有可用的優惠券。</Text>
              </View>
            ) : (
              filteredCoupons.map((coupon) => (
                <Coupon
                  key={coupon.id}
                  couponName={coupon.couponName}
                  storeName={coupon.storeName}
                  id={coupon.id}
                  imageUrl={coupon.imageUrl}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EasyUse;
