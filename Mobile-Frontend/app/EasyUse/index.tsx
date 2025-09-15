import React, { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Image, Text, View, ScrollView, Input, Button, XStack, H4, YStack, Card } from 'tamagui';
import { fetchAPI } from '../utils/authAPI';
import { TouchableOpacity } from 'react-native';
import { AlignJustify, Search, MoreHorizontalIcon, X } from 'lucide-react-native';
import TabsFooter from '../components/TabsFooter';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapComponent, { type Store } from '../components/MapComponent';

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

// Removed Store typing while using placeholders
// Removed ApiCoupon in placeholders mode

// Logo Icon Component
const LogoIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M23.9895 16.8578C23.9895 20.7967 20.7963 23.9898 16.8574 23.9898C12.9185 23.9898 9.72544 20.7967 9.72544 16.8578C9.72544 12.9188 12.9185 9.72571 16.8574 9.72571C20.7963 9.72571 23.9895 12.9188 23.9895 16.8578Z"
      fill="#333333"
    />
    <Path
      d="M2.08892 12.1754C0.751406 10.8378 2.85613e-07 9.02378 0 7.13224C-2.85612e-07 5.2407 0.751405 3.42664 2.08892 2.08912C3.42643 0.751602 5.24048 0.000191455 7.13201 0.000190575C9.02353 0.000189696 10.8376 0.751599 12.1751 2.08912L9.65355 4.61068C8.9848 3.94192 8.07777 3.56621 7.13201 3.56621C6.18624 3.56621 5.27922 3.94192 4.61046 4.61068C3.94171 5.27944 3.566 6.18647 3.566 7.13224C3.566 8.07801 3.94171 8.98504 4.61046 9.6538L2.08892 12.1754Z"
      fill="#FFAD31"
    />
    <Path
      d="M0.691765 23.3084C-0.219762 22.3968 -0.235644 20.9031 0.675883 19.9915L19.9915 0.67576C20.9031 -0.235772 22.3968 -0.21989 23.3084 0.691642C24.2199 1.60317 24.2358 3.09694 23.3242 4.00847L4.00858 23.3242C3.09705 24.2358 1.60329 24.2199 0.691765 23.3084Z"
      fill="#333333"
    />
    <Path
      d="M20.3586 16.7929C20.3586 18.7624 18.7621 20.3589 16.7926 20.3589C14.8232 20.3589 13.2266 18.7624 13.2266 16.7929C13.2266 14.8235 14.8232 13.2269 16.7926 13.2269C18.7621 13.2269 20.3586 14.8235 20.3586 16.7929Z"
      fill="#FFAD31"
    />
  </Svg>
);

// Coupon Card Component
interface CouponCardProps {
  storeName: string;
  description: string;
  imageUrl?: string;
  id?: number;
  onPress: () => void;
}

const CouponCard: React.FC<CouponCardProps> = ({ storeName, description, imageUrl, onPress }) => (
  <Card
    elevate
    bordered
    borderRadius="$5"
    padding="$4"
    onPress={onPress}
    pressStyle={{ opacity: 0.9 }}
    borderColor="#f8f8f8"
    borderWidth={1}
    bg="white"
  >
    <XStack gap={15} style={{ alignItems: 'center' }}>

      <Image
        source={{
          uri: imageUrl || 'https://api.iconify.design/material-symbols:storefront-rounded.svg?color=%23ffad31',
          width: 64,
          height: 64,
        }}
        style={{ borderRadius: 8 }}
      />

      <YStack gap={8}>
        <Text fontSize={24} fontWeight="700" color="#000000">
          {storeName}
        </Text>

        <Text color="#6b7280">
          {description}
        </Text>
      </YStack>

    </XStack>
  </Card>
);

const CouPro = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  // Skipping backend state in placeholders mode
  const [searchQuery, setSearchQuery] = useState('');
  const [coupons, setCoupons] = useState<CouponType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<string[]>(['飲料', '麵']);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    const searchParam = params.search as string;
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [params.search]);

  // Fetch coupons from backend
  useEffect(() => {
    const fetchCoupons = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchAPI('/store-coupons/', { method: 'GET' });
        const data = response?.data ?? [];
        if (!Array.isArray(data)) {
          throw new Error('Unexpected API response format');
        }
        const transformed: CouponType[] = data.map((coupon: any) => ({
          id: coupon.id,
          storeName: coupon.store_name,
          couponName: coupon.coupon_name,
          description: coupon.coupon_detail,
          importantNotes: coupon.important_notes,
          startDate: coupon.start_date ? new Date(coupon.start_date) : new Date(),
          expiryDate: coupon.expiry_date ? new Date(coupon.expiry_date) : new Date(),
          couponType: coupon.coupon_type,
          sourceUser: coupon.source_user,
          storeId: coupon.store_id,
          storeLocation: coupon.store_location,
          address: coupon.address,
          active_coupon_count: coupon.active_coupon_count,
          has_active_coupons: coupon.has_active_coupons,
          imageUrl: coupon.image_url,
        }));
        setCoupons(transformed);
      } catch (err: any) {
        console.error('Error fetching coupons:', err);
        setError(err?.message || '載入失敗');
        setCoupons([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCoupons();
  }, [router]);

  useEffect(() => {
    if (coupons) {
      const uniqueStores = new Map<number, Store>();
      coupons.forEach(coupon => {
        if (coupon.storeId && coupon.storeLocation) {
          if (!uniqueStores.has(coupon.storeId)) {
            uniqueStores.set(coupon.storeId, {
              id: coupon.storeId,
              name: coupon.storeName,
              location: coupon.storeLocation,
            });
          }
        }
      });
      setStores(Array.from(uniqueStores.values()));
    }
  }, [coupons]);

  const filteredCoupons = coupons.filter((coupon) => {
    return searchQuery
      ? coupon.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coupon.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
  });

  const toggleCategory = (category: string) => {
    setActiveCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const onMenuIconClick = () => {
    router.push('/OptionsMenu');
  };

  const onCouponPress = (couponId?: number) => {
    if (couponId) {
      router.push(`/EasyUse/${couponId}`);
    } else {
      console.error('Coupon ID is undefined, cannot navigate.');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <YStack flex={1}>
        {/* Header */}
        <YStack gap={15} style={{
          backgroundColor: 'white',
          paddingHorizontal: 15,
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
          elevation: 6, // for Android
        }}>
          <XStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <XStack gap={13} style={{ alignItems: 'center' }}>
              <LogoIcon />
              <H4 color="#000000" fontSize={24} fontWeight={'bold'}>
                CouPro
              </H4>
            </XStack>

            <TouchableOpacity onPress={onMenuIconClick} activeOpacity={0.7}>
              <AlignJustify color='black' />
            </TouchableOpacity>
          </XStack>

          {/* Search Bar */}
          <XStack gap={12} style={{
            backgroundColor: 'white',
            borderColor: '#a8a8a8',
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            alignItems: 'center'
          }}>
            {/* <SearchIcon /> */}
            <Search color='#a8a8a8' />
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder=""
              style={{ flex: 1 }}
              unstyled
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <X color='#a8a8a8'></X>
              </TouchableOpacity>
            )}
          </XStack>
        </YStack>

        <View style={{ height: 200 }}>
          <MapComponent stores={stores} />
        </View>

        <View flex={1} gap={13}>
          {/* Main Content */}
          <ScrollView style={{ flex: 1 }}>

            <YStack gap={13} style={{ paddingHorizontal: 13, paddingVertical: 30 }}>
              {/* Coupon Cards */}
              {isLoading ? (
                <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  <Text color="#6b7280">載入中…</Text>
                </View>
              ) : error ? (
                <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  <Text color="#ef4444">{error}</Text>
                </View>
              ) : filteredCoupons.length === 0 ? (
                <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  <Text color="#6b7280">目前沒有可用的優惠券。</Text>
                </View>
              ) : (
                filteredCoupons.map((coupon) => (
                  <CouponCard
                    key={coupon.id}
                    storeName={coupon.storeName}
                    description={coupon.description}
                    imageUrl={coupon.imageUrl}
                    id={coupon.id}
                    onPress={() => onCouponPress(coupon.id)}
                  />
                ))
              )}
            </YStack>
          </ScrollView>
        </View>
        {/* Bottom Navigation */}
        <TabsFooter
          activeTab="home"
          onHomePress={() => router.push('/EasyUse')}
          onCollectionPress={() => router.push('/Collection')}
          onStatisticsPress={() => router.push('/Statistics')}
        />
      </YStack >

    </>
  );
};

export default CouPro;
