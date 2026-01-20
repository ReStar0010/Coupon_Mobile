import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Image, Text, View, ScrollView, Input, Button, XStack, H4, YStack, Card, Spinner } from 'tamagui';
import { fetchAPI, isUserLoggedIn } from '../utils/authAPI';
import { TouchableOpacity, Alert, Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { AlignJustify, Search, MoreHorizontalIcon, X } from 'lucide-react-native';
import TabsFooter from '../components/TabsFooter';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapComponent, { type Store } from '../components/MapComponent';
import { BackendIndicator } from '../components/BackendIndicator';
import { devLog } from '../utils/devLogger';
import * as Location from 'expo-location';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const NAVIGATION_FOOTER_HEIGHT = 80; // 導航欄高度（包括 safe area）
const BOTTOM_SHEET_MIN_HEIGHT = 60; // 最小高度（只顯示拖動指示器，在導航欄上方）
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.5 - NAVIGATION_FOOTER_HEIGHT; // 最大高度（50% 屏幕高度，減去導航欄高度）

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
    borderRadius="$6"
    padding="$5"
    onPress={onPress}
    pressStyle={{ opacity: 0.9 }}
    borderColor="#e5e5e5"
    borderWidth={1}
    backgroundColor="white"
    shadowColor="black"
    shadowRadius={8}
    shadowOffset={{ width: 0, height: 2 }}
    shadowOpacity={0.08}
    elevation={3}
    height="auto"
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
          <XStack gap={6} flexWrap="wrap" style={{ marginTop: 4 }}>
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
    borderRadius="$6"
    padding="$5"
    borderColor="#e5e5e5"
    borderWidth={1}
    backgroundColor="white"
    shadowColor="black"
    shadowRadius={8}
    shadowOffset={{ width: 0, height: 2 }}
    shadowOpacity={0.08}
    elevation={3}
    height="auto"
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
          <XStack gap={8} style={{ alignItems: 'center' }}>
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

      <TouchableOpacity
        onPress={onClaim}
        disabled={isClaiming}
        style={{
          backgroundColor: '#FFAD31',
          borderRadius: 8,
          paddingVertical: 12,
          paddingHorizontal: 16,
          opacity: isClaiming ? 0.7 : 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        activeOpacity={0.8}
      >
        {isClaiming ? (
          <XStack style={{ alignItems: 'center' }} gap="$2">
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
      </TouchableOpacity>
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
  const mapRef = useRef<any>(null);
  
  // Bottom sheet animation
  // Initial position: panel shows only MIN_HEIGHT at bottom
  // translateY = MAX_HEIGHT - MIN_HEIGHT means panel is at minimum (only showing bottom part)
  // translateY = 0 means panel is fully expanded
  const INITIAL_TRANSLATE_Y = BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
  const panY = useRef(new Animated.Value(INITIAL_TRANSLATE_Y)).current;
  const startTranslateY = useRef(INITIAL_TRANSLATE_Y);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // 只響應向上或向下的拖動
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // 保存開始拖動時的位置
        const currentValue = (panY as any).__getValue ? (panY as any).__getValue() : INITIAL_TRANSLATE_Y;
        startTranslateY.current = currentValue;
        panY.setOffset(currentValue);
        panY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // gestureState.dy < 0 means dragging up (expanding) - translateY decreases
        // gestureState.dy > 0 means dragging down (collapsing) - translateY increases
        const newTranslateY = startTranslateY.current - gestureState.dy;
        
        // 限制拖動範圍
        if (newTranslateY >= 0 && newTranslateY <= INITIAL_TRANSLATE_Y) {
          panY.setValue(-gestureState.dy);
        } else if (newTranslateY < 0) {
          // 超過上限，設置為 0
          panY.setValue(-startTranslateY.current);
        } else if (newTranslateY > INITIAL_TRANSLATE_Y) {
          // 超過下限，設置為最大值
          panY.setValue(INITIAL_TRANSLATE_Y - startTranslateY.current);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // 計算最終位置
        const finalTranslateY = startTranslateY.current - gestureState.dy;
        
        // 使用拖動距離、速度和位置來決定是否展開
        const dragThreshold = 50;
        const velocityThreshold = 0.5;
        const midPoint = INITIAL_TRANSLATE_Y / 2;
        
        // 判斷是否應該展開
        const shouldExpand = 
          gestureState.dy < -dragThreshold || // 向上拖動超過閾值
          (gestureState.dy < 0 && finalTranslateY < midPoint) || // 向上拖動且超過中點
          (gestureState.vy < -velocityThreshold); // 快速向上滑動
        
        panY.flattenOffset();
        
        if (shouldExpand) {
          // 展開到底部面板
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        } else {
          // 收起到最小高度
          Animated.spring(panY, {
            toValue: INITIAL_TRANSLATE_Y,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

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

  // Handle locate user button
  const handleLocateUser = async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('提示', '定位功能僅適用於移動設備');
        return;
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要位置權限', '請在設定中開啟位置服務');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const userPos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

      // Animate map to user location
      if (mapRef.current) {
        mapRef.current.animateToRegion(userPos, 1000);
      } else {
        Alert.alert('錯誤', '地圖尚未準備就緒');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('定位錯誤', '無法獲取當前位置');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {__DEV__ && <BackendIndicator />}
      
      <View style={{ flex: 1 }}>
        {/* Full Screen Map */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <MapComponent stores={stores} searchQuery={searchQuery} mapRef={mapRef} />
        </View>

        {/* Search Bar - Absolute Positioned at Top */}
        <View style={{
          position: 'absolute',
          top: insets.top + 10,
          left: 15,
          right: 15,
          zIndex: 1000,
        }}>
          <YStack gap={10} style={{
            backgroundColor: 'white',
            borderRadius: 12,
            paddingHorizontal: 15,
            paddingVertical: 10,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
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
              backgroundColor: '#f5f5f5',
              borderColor: '#e0e0e0',
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              alignItems: 'center'
            }}>
              <Search color='#a8a8a8' size={20} />
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="搜尋店家或優惠券..."
                style={{ flex: 1, fontSize: 16 }}
                unstyled
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <X color='#a8a8a8' size={20} />
                </TouchableOpacity>
              )}
            </XStack>
          </YStack>
        </View>

        {/* Bottom Sheet - Draggable Panel */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: NAVIGATION_FOOTER_HEIGHT, // Position above navigation footer
            left: 0,
            right: 0,
            height: BOTTOM_SHEET_MAX_HEIGHT + BOTTOM_SHEET_MIN_HEIGHT, // Total height includes min height
            transform: [{ translateY: panY }],
            zIndex: 999,
          }}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'white',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
            overflow: 'hidden',
          }}>
            {/* Drag Handle - Only this area responds to drag gestures */}
            <View 
              style={{
                paddingTop: 12,
                paddingBottom: 8,
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: '#e5e5e5',
              }}
              {...panResponder.panHandlers}
            >
              <View style={{
                width: 40,
                height: 10,
                backgroundColor: '#d0d0d0',
                borderRadius: 5,
              }} />
            </View>

            {/* Content Area */}
            <View style={{ flex: 1 }}>
              <ScrollView 
                style={{ flex: 1, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                <YStack gap={13} style={{ paddingHorizontal: 15, paddingTop: 20 }}>
                  {/* Scan to Claim Coupon Button */}
                  <TouchableOpacity
                    onPress={() => router.push('/EasyUse/qr-claim')}
                    style={{
                      backgroundColor: '#ffad31',
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>
                      掃描 QR Code 領取優惠券
                    </Text>
                  </TouchableOpacity>

                  {/* Coupon Cards */}
                  {isLoading ? (
                    <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                      <Spinner size="large" color="#FFAD31" />
                      <Text color="#6b7280" style={{ marginTop: 16 }}>載入中…</Text>
                    </View>
                  ) : error ? (
                    <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                      <Text color="#ef4444" fontSize={16}>{error}</Text>
                    </View>
                  ) : filteredCoupons.length === 0 ? (
                    <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                      <Text color="#6b7280" fontSize={16}>目前沒有可用的優惠券。</Text>
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
          </View>
        </Animated.View>

        {/* Locate User Button - Top Right (below search bar) */}
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            onPress={handleLocateUser}
            style={{
              position: 'absolute',
              top: insets.top + 150, // Below search bar
              right: 20,
              backgroundColor: '#FFAD31',
              borderRadius: 25,
              width: 50,
              height: 50,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
              zIndex: 1002, // Above bottom sheet and navigation
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 24 }}>📍</Text>
          </TouchableOpacity>
        )}

        {/* Bottom Navigation - Always visible at bottom of screen */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#e5e5e5',
          zIndex: 1001, // Above bottom sheet
        }}>
          <TabsFooter
            activeTab="home"
            onHomePress={() => router.push('/EasyUse')}
            onCollectionPress={() => router.push('/Collection')}
            onStatisticsPress={() => router.push('/Statistics')}
          />
        </View>
      </View>
    </>
  );
};

export default CouPro;
