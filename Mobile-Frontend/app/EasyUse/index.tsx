import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Image, Text, View, ScrollView, Input, Button, XStack, H4, YStack, Card, Spinner } from 'tamagui';
import { fetchAPI, isUserLoggedIn } from '../utils/authAPI';
import { TouchableOpacity, Alert } from 'react-native';
import { AlignJustify, Search, MoreHorizontalIcon, X } from 'lucide-react-native';
import TabsFooter from '../components/TabsFooter';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapComponent, { type Store } from '../components/MapComponent';
import { BackendIndicator } from '../components/BackendIndicator';
import { devLog } from '../utils/devLogger';

export type CouponType = {
  className?: string;
  id?: number;
  storeName: string;
  couponName: string;
  description: string;
  importantNotes?: string;
  startDate: Date;
  expiryDate: Date;
  couponType: 'store' | 'exclusive' | 'gift';
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
  tags?: string[];
  // Public share fields
  isPublicShare?: boolean;
  shareToken?: string;
  sharedBy?: string;
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
  tags?: string[];
  onPress: () => void;
}

const CouponCard: React.FC<CouponCardProps> = ({ storeName, description, imageUrl, tags, onPress }) => (
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
        style={{ borderRadius: 8, flexShrink: 0 }}
      />

      <YStack gap={8} flex={1} style={{ flexShrink: 1 }}>
        <Text fontSize={24} fontWeight="700" color="#000000" numberOfLines={1} ellipsizeMode="tail">
          {storeName}
        </Text>

        <Text color="#6b7280" numberOfLines={2} ellipsizeMode="tail">
          {description}
        </Text>

        {tags && tags.length > 0 && (
          <XStack gap={6} flexWrap="wrap" marginTop={4}>
            {tags.map((tag, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: '#FFF5E6',
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text fontSize={12} color="#FFAD31" fontWeight="500">
                  {tag}
                </Text>
              </View>
            ))}
          </XStack>
        )}
      </YStack>

    </XStack>
  </Card>
);

// Gift Card Component for public pool coupons
interface GiftCardProps {
  storeName: string;
  couponName: string;
  description: string;
  imageUrl?: string;
  tags?: string[];
  shareToken: string;
  sharedBy: string;
  onClaim: () => void;
  isClaiming?: boolean;
}

const GiftCard: React.FC<GiftCardProps> = ({
  storeName,
  couponName,
  description,
  imageUrl,
  tags,
  shareToken,
  sharedBy,
  onClaim,
  isClaiming = false
}) => (
  <Card
    elevate
    bordered
    borderRadius="$5"
    padding="$4"
    borderColor="#FFE4B5"
    borderWidth={2}
    bg="white"
  >
    <YStack gap={12}>
      <XStack gap={15} style={{ alignItems: 'center' }}>
        <Image
          source={{
            uri: imageUrl || 'https://api.iconify.design/mdi:gift.svg?color=%23ffad31',
            width: 64,
            height: 64,
          }}
          style={{ borderRadius: 8, flexShrink: 0 }}
        />

        <YStack gap={8} flex={1} style={{ flexShrink: 1 }}>
          <XStack gap={8} alignItems="center">
            <Text fontSize={12} color="#FFAD31" fontWeight="600">
              公開交換池禮物
            </Text>
          </XStack>
          <Text fontSize={24} fontWeight="700" color="#000000" numberOfLines={1} ellipsizeMode="tail">
            {storeName}
          </Text>
          <Text color="#6b7280" numberOfLines={2} ellipsizeMode="tail">
            {couponName}
          </Text>
          <Text fontSize={12} color="#9ca3af">
            分享者: {sharedBy}
          </Text>
        </YStack>
      </XStack>

      {tags && tags.length > 0 && (
        <XStack gap={6} flexWrap="wrap">
          {tags.map((tag, index) => (
            <View
              key={index}
              style={{
                backgroundColor: '#FFF5E6',
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text fontSize={12} color="#FFAD31" fontWeight="500">
                {tag}
              </Text>
            </View>
          ))}
        </XStack>
      )}

      <Button
        backgroundColor="#FFAD31"
        borderRadius="$3"
        paddingVertical="$3"
        onPress={onClaim}
        disabled={isClaiming}
        opacity={isClaiming ? 0.7 : 1}
      >
        {isClaiming ? (
          <XStack alignItems="center" gap="$2">
            <Spinner size="small" color="#000" />
            <Text color="#000" fontSize={16} fontWeight="bold">
              領取中...
            </Text>
          </XStack>
        ) : (
          <Text color="#000" fontSize={16} fontWeight="bold">
            領取禮物
          </Text>
        )}
      </Button>
    </YStack>
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
  const [claimingToken, setClaimingToken] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    const searchParam = params.search as string;
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [params.search]);

  // Fetch coupons from backend
  const fetchCoupons = useCallback(async () => {
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
        tags: coupon.tags,
        // Public share fields
        isPublicShare: coupon.is_public_share || false,
        shareToken: coupon.share_token,
        sharedBy: coupon.shared_by,
      }));
      setCoupons(transformed);
    } catch (err: any) {
      console.error('Error fetching coupons:', err);
      
      // Filter out 401 authentication errors - they are handled silently by AuthOrchestrator
      // Check both status code and error message
      const isAuthError = 
        (err?.response?.status === 401) ||
        (err?.message?.includes('Authentication')) ||
        (err?.message?.includes('401'));
      
      if (!isAuthError) {
        // Only set error for non-authentication errors
        setError(err?.message || '載入失敗');
        setCoupons([]);
      }
      // For 401 errors, silently let AuthOrchestrator handle the redirect
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // Handle claiming a gift from public pool
  const handleClaimGift = useCallback(async (shareToken: string) => {
    // Check if user is logged in
    if (!isUserLoggedIn()) {
      router.push(`/Login?returnUrl=${encodeURIComponent('/EasyUse')}`);
      return;
    }

    setClaimingToken(shareToken);

    try {
      devLog('Claiming gift with token:', shareToken);
      const response = await fetchAPI(`/coupon/share/${shareToken}/accept/`, {
        method: 'POST',
      });

      Alert.alert(
        '領取成功！',
        `您已獲得: ${response.data.coupon_name}`,
        [
          {
            text: '查看收藏',
            onPress: () => router.push('/Collection')
          },
          {
            text: '繼續瀏覽',
            onPress: () => {
              // Refresh the coupon list to remove claimed item
              fetchCoupons();
            }
          }
        ]
      );
    } catch (err: any) {
      console.error('Error claiming gift:', err);
      let errorMessage = '無法領取優惠券';

      if (err?.response?.data?.error) {
        const backendError = err.response.data.error;
        if (backendError === 'You cannot claim your own shared coupon.') {
          errorMessage = '您不能領取自己分享的優惠券';
        } else if (backendError === 'This request has already been processed.') {
          errorMessage = '此優惠券已被其他人領取';
        } else if (backendError === 'This coupon has already been claimed.') {
          errorMessage = '此優惠券已被領取';
        } else {
          errorMessage = backendError;
        }
      }

      Alert.alert('領取失敗', errorMessage);
    } finally {
      setClaimingToken(null);
    }
  }, [router, fetchCoupons]);

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
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase().trim();
    
    // 搜尋店家名稱
    if (coupon.storeName?.toLowerCase().includes(query)) return true;
    
    // 搜尋優惠內容
    if (coupon.description?.toLowerCase().includes(query)) return true;
    
    // 搜尋標籤
    if (coupon.tags && coupon.tags.length > 0) {
      const tagMatch = coupon.tags.some(tag => 
        tag.toLowerCase().includes(query)
      );
      if (tagMatch) return true;
    }
    
    return false;
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
      {__DEV__ && <BackendIndicator />}
      
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
          <MapComponent stores={stores} searchQuery={searchQuery} />
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
                  coupon.couponType === 'gift' && coupon.shareToken ? (
                    <GiftCard
                      key={`gift-${coupon.id}`}
                      storeName={coupon.storeName}
                      couponName={coupon.couponName}
                      description={coupon.description}
                      imageUrl={coupon.imageUrl}
                      tags={coupon.tags}
                      shareToken={coupon.shareToken}
                      sharedBy={coupon.sharedBy || '未知用戶'}
                      onClaim={() => handleClaimGift(coupon.shareToken!)}
                      isClaiming={claimingToken === coupon.shareToken}
                    />
                  ) : (
                    <CouponCard
                      key={coupon.id}
                      storeName={coupon.storeName}
                      description={coupon.description}
                      imageUrl={coupon.imageUrl}
                      tags={coupon.tags}
                      id={coupon.id}
                      onPress={() => onCouponPress(coupon.id)}
                    />
                  )
                ))
              )}
            </YStack>
          </ScrollView>
        </View>
        
        {/* Scan to Claim Coupon Button */}
        <View style={{ paddingHorizontal: 13, paddingBottom: 10 }}>
          <TouchableOpacity
            onPress={() => router.push('/EasyUse/qr-claim')}
            style={{
              backgroundColor: '#ffad31',
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              掃描 QR Code 領取優惠券
            </Text>
          </TouchableOpacity>
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
