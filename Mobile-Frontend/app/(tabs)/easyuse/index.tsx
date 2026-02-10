import * as React from 'react';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Image, Text, View, Input, XStack, H4, YStack, Card, Spinner } from 'tamagui';
import { fetchAPI, isUserLoggedIn } from '@/app/utils/authAPI';
import { TouchableOpacity, Alert, Dimensions, Platform, Linking, StyleSheet } from 'react-native';
import { AlignJustify, Search, X } from 'lucide-react-native';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapComponent, { type Store } from '../../components/MapComponent';
import { BackendIndicator } from '../../components/BackendIndicator';
import * as Location from 'expo-location';
import { useDismissedStores } from '@/app/components/providers/DismissedStoresProvider';
import MerchantDeletedModal from '../../components/MerchantDeletedModal';

// @gorhom/bottom-sheet imports
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

// react-native-reanimated imports
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { useCallback, useEffect, useMemo, useRef, useState } = React;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// 位置權限說明：讓用戶了解為何需要位置
const LOCATION_USAGE_TITLE = '需要位置權限';
const LOCATION_USAGE_MESSAGE =
  'CouPro 需要存取您的位置，以在地圖上顯示您的位置、計算與店家的距離與步行時間，讓您更快找到附近的優惠券。';
const LOCATION_DENIED_IOS =
  `${LOCATION_USAGE_MESSAGE}\n\n請前往「設定」>「CouPro」>「位置」，選擇「使用 App 期間」或「永遠」來開啟位置服務。`;
const LOCATION_DENIED_ANDROID =
  `${LOCATION_USAGE_MESSAGE}\n\n請前往「設定」>「應用程式」>「CouPro」>「權限」>「位置」，選擇「允許」來開啟位置服務。`;
function showLocationDeniedAlert(): void {
  const message = Platform.OS === 'ios' ? LOCATION_DENIED_IOS : LOCATION_DENIED_ANDROID;
  Alert.alert(LOCATION_USAGE_TITLE, message, [
    { text: '取消', style: 'cancel' },
    { text: '前往設定', onPress: () => Linking.openSettings().catch(() => {}) },
  ]);
}

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
  isPublicShare?: boolean;
  shareToken?: string;
  sharedBy?: string;
  merchantDeleted?: boolean;
};

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

// Custom Backdrop Component with animated opacity
const CustomBackdrop = ({ animatedIndex, style, ...props }: BottomSheetBackdropProps) => {
  // Animate backdrop opacity: show when index > 1 (approaching full state)
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      animatedIndex.value,
      [1, 2],
      [0, 0.6],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <BottomSheetBackdrop
      {...props}
      animatedIndex={animatedIndex}
      style={[style, animatedStyle]}
      disappearsOnIndex={1}
      appearsOnIndex={2}
      pressBehavior="collapse"
    />
  );
};

const CouPro = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { dismissStore, isStoreDismissed } = useDismissedStores();

  const [searchQuery, setSearchQuery] = useState('');
  const [coupons, setCoupons] = useState<CouponType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [claimingToken, setClaimingToken] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Bottom sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Snap points: Peek (15%), Median (50%), Full (95%)
  const snapPoints = useMemo(() => ['15%', '50%', '95%'], []);

  // Animated position value for coordinating animations
  const animatedPosition = useSharedValue(0);
  const animatedIndex = useSharedValue(0);

  // Track current sheet state for UI logic
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);

  // Spring configuration for natural, tactile feel
  const animationConfigs = useMemo(() => ({
    damping: 15,
    stiffness: 150,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  }), []);

  // Merchant deleted modal state
  const [merchantDeletedModal, setMerchantDeletedModal] = useState<{
    isOpen: boolean;
    storeName: string;
    storeId: number | null;
  }>({ isOpen: false, storeName: '', storeId: null });

  // ============================================
  // ANIMATED STYLES
  // ============================================

  // Bottom Sheet Handle/Container Border Radius Animation
  const sheetContainerAnimatedStyle = useAnimatedStyle(() => {
    // Border radius goes from 20 to 0 as index moves from 1 to 2
    const borderRadius = interpolate(
      animatedIndex.value,
      [1, 2],
      [20, 0],
      Extrapolation.CLAMP
    );
    return {
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
    };
  });

  // Search Bar & Locate Button Fade Out Animation
  const searchBarAnimatedStyle = useAnimatedStyle(() => {
    // Stay visible (opacity: 1) from index 0 to 1, fade out from 1 to 2
    const opacity = interpolate(
      animatedIndex.value,
      [0, 1, 2],
      [1, 1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const locateButtonAnimatedStyle = useAnimatedStyle(() => {
    // Stay visible (opacity: 1) from index 0 to 1, fade out from 1 to 2
    const opacity = interpolate(
      animatedIndex.value,
      [0, 1, 2],
      [1, 1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // ============================================
  // BOTTOM SHEET HANDLERS
  // ============================================

  const handleSheetChanges = useCallback((index: number) => {
    setCurrentSnapIndex(index);
    animatedIndex.value = withSpring(index, animationConfigs);
  }, [animatedIndex, animationConfigs]);

  const handleAnimate = useCallback((fromIndex: number, toIndex: number) => {
    'worklet';
    // Update animatedIndex for smooth interpolation
    animatedIndex.value = withSpring(toIndex, {
      damping: 15,
      stiffness: 150,
    });
  }, [animatedIndex]);

  // Collapse to peek state
  const collapseBottomSheet = useCallback(() => {
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  // Expand to half state
  const expandBottomSheetHalf = useCallback(() => {
    bottomSheetRef.current?.snapToIndex(1);
  }, []);

  // Expand to full state
  const expandBottomSheetFull = useCallback(() => {
    bottomSheetRef.current?.snapToIndex(2);
  }, []);

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const formatDistance = (meters: number) => {
    if (!Number.isFinite(meters) || meters < 0) return null;
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const estimateWalkMinutes = (meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) return null;
    const minutes = Math.max(1, Math.round(meters / (1.3 * 60)));
    return minutes;
  };

  const haversineMeters = (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
  ) => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const toFiniteNumber = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const getStoreDistanceMeters = useCallback((store: Store) => {
    if (!userCoords) return null;
    const lat = toFiniteNumber(store?.location?.lat);
    const lng = toFiniteNumber(store?.location?.lng);
    if (lat == null || lng == null) return null;
    return haversineMeters(userCoords, { latitude: lat, longitude: lng });
  }, [userCoords]);

  const getStoreExpiryInfo = useCallback((storeId?: number) => {
    if (!storeId) return { expiringSoonCount: 0, soonestExpiry: null as Date | null };
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    const storeCoupons = coupons.filter(c => c.storeId === storeId && c.couponType !== 'gift');
    let expiringSoonCount = 0;
    let soonestExpiry: Date | null = null;
    for (const c of storeCoupons) {
      const t = c.expiryDate?.getTime?.() ? c.expiryDate.getTime() : null;
      if (!t) continue;
      if (t >= now && t <= in24h) expiringSoonCount += 1;
      if (t >= now && (!soonestExpiry || t < soonestExpiry.getTime())) {
        soonestExpiry = new Date(t);
      }
    }
    return { expiringSoonCount, soonestExpiry };
  }, [coupons]);

  // ============================================
  // DATA FETCHING
  // ============================================

  useEffect(() => {
    const searchParam = params.search as string;
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [params.search]);

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
        isPublicShare: coupon.is_public_share || false,
        shareToken: coupon.share_token,
        sharedBy: coupon.shared_by,
        merchantDeleted: coupon.merchant_deleted || false,
      }));
      setCoupons(transformed);
    } catch (err: any) {
      console.error('Error fetching coupons:', err);
      const isAuthError =
        (err?.response?.status === 401) ||
        (err?.message?.includes('Authentication')) ||
        (err?.message?.includes('401'));
      if (!isAuthError) {
        setError(err?.message || '載入失敗');
        setCoupons([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // Request location on mount（附說明：用於顯示附近優惠與距離）
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          showLocationDeniedAlert();
          return;
        }
        const location = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setUserCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch {
        // Ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Handle claiming a gift
  const handleClaimGift = useCallback(async (shareToken: string) => {
    if (!isUserLoggedIn()) {
      router.push(`/(auth)/login?returnUrl=${encodeURIComponent('/(tabs)/easyuse')}`);
      return;
    }

    setClaimingToken(shareToken);

    try {
      const response = await fetchAPI(`/coupon/share/${shareToken}/accept/`, {
        method: 'POST',
      });

      Alert.alert(
        '領取成功！',
        `您已獲得: ${response.data.coupon_name}`,
        [
          {
            text: '查看收藏',
            onPress: () => router.push('/(tabs)/collection')
          },
          {
            text: '繼續瀏覽',
            onPress: () => {
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
            const lat = toFiniteNumber((coupon.storeLocation as any)?.lat);
            const lng = toFiniteNumber((coupon.storeLocation as any)?.lng);
            if (lat == null || lng == null) return;
            uniqueStores.set(coupon.storeId, {
              id: coupon.storeId,
              name: coupon.storeName,
              location: { lat, lng },
              address: coupon.address,
              active_coupon_count: coupon.active_coupon_count,
              has_active_coupons: coupon.has_active_coupons,
            });
          }
        }
      });
      setStores(Array.from(uniqueStores.values()));
    }
  }, [coupons]);

  const filteredCoupons = coupons.filter((coupon) => {
    if (coupon.storeId && isStoreDismissed(coupon.storeId)) {
      return false;
    }

    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase().trim();

    if (coupon.storeName?.toLowerCase().includes(query)) return true;
    if (coupon.description?.toLowerCase().includes(query)) return true;
    if (coupon.tags && coupon.tags.length > 0) {
      const tagMatch = coupon.tags.some(tag =>
        tag.toLowerCase().includes(query)
      );
      if (tagMatch) return true;
    }

    return false;
  });

  const onMenuIconClick = () => {
    router.push('/options-menu');
  };

  const onCouponPress = (coupon: CouponType) => {
    if (!coupon.id) {
      console.error('Coupon ID is undefined, cannot navigate.');
      return;
    }

    if (coupon.merchantDeleted && coupon.storeId) {
      setMerchantDeletedModal({
        isOpen: true,
        storeName: coupon.storeName,
        storeId: coupon.storeId,
      });
      return;
    }

    router.push(`/(tabs)/easyuse/${coupon.id}`);
  };

  const handleMerchantDeletedModalClose = async () => {
    if (merchantDeletedModal.storeId) {
      await dismissStore(merchantDeletedModal.storeId);
    }
    setMerchantDeletedModal({ isOpen: false, storeName: '', storeId: null });
  };

  const handleLocateUser = async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('提示', '定位功能僅適用於移動設備');
        return;
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showLocationDeniedAlert();
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      const userPos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

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

  const handleStorePress = useCallback((store: Store | null) => {
    setSelectedStore(store);
    if (store) {
      expandBottomSheetHalf();
    }
  }, [expandBottomSheetHalf]);

  const handleNavigateToStore = useCallback(async (store: Store) => {
    const lat = store?.location?.lat;
    const lng = store?.location?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      Alert.alert('無法導航', '此店家缺少定位資訊');
      return;
    }
    const label = encodeURIComponent(store?.name || '店家');
    const googleUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=walking`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking&destination_name=${label}`;
    try {
      const canOpenGoogle = await Linking.canOpenURL(googleUrl);
      await Linking.openURL(canOpenGoogle ? googleUrl : webUrl);
    } catch (e) {
      await Linking.openURL(webUrl);
    }
  }, []);

  // Render backdrop callback
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <CustomBackdrop {...props} />
    ),
    []
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {__DEV__ && <BackendIndicator />}

      <DismissKeyboardView>
        <View style={styles.container}>
        {/* Full Screen Map */}
        <View style={styles.mapContainer}>
          <MapComponent
            stores={stores}
            searchQuery={searchQuery}
            setStoreSearch={setSearchQuery}
            onStorePress={handleStorePress}
            mapRef={mapRef}
          />
        </View>

        {/* Search Bar */}
        <Animated.View
          style={[
            styles.searchBarContainer,
            { top: insets.top + 10 },
            searchBarAnimatedStyle,
          ]}
          pointerEvents={currentSnapIndex >= 2 ? 'none' : 'box-none'}
        >
          <YStack
            gap={10}
            style={styles.searchBarContent}
          >
            <XStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <XStack gap={13} style={{ alignItems: 'center' }}>
                <LogoIcon />
                <H4 color="#000000" fontSize={24} fontWeight={'bold'}>
                  CouPro
                </H4>
              </XStack>

              <TouchableOpacity onPress={onMenuIconClick} activeOpacity={0.7}>
                <AlignJustify color="black" />
              </TouchableOpacity>
            </XStack>

            {/* Search Input */}
            <XStack
              gap={12}
              style={styles.searchInputContainer}
            >
              <Search color="#a8a8a8" size={20} />
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="搜尋店家或優惠券..."
                style={{ flex: 1, fontSize: 16 }}
                unstyled
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <X color="#a8a8a8" size={20} />
                </TouchableOpacity>
              )}
            </XStack>
          </YStack>
        </Animated.View>

        {/* Locate User Button */}
        {Platform.OS !== 'web' && (
          <Animated.View
            style={[
              styles.locateButton,
              { top: insets.top + 150 },
              locateButtonAnimatedStyle,
            ]}
            pointerEvents={currentSnapIndex >= 2 ? 'none' : 'box-none'}
          >
            <TouchableOpacity
              onPress={handleLocateUser}
              style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24 }}>📍</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Bottom Sheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          onChange={handleSheetChanges}
          onAnimate={handleAnimate}
          enablePanDownToClose={false}
          enableDynamicSizing={false}
          animateOnMount={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.handleIndicator}
          backgroundStyle={styles.sheetBackground}
          style={styles.bottomSheet}
          animationConfigs={animationConfigs}
          enableContentPanningGesture={true}
          enableHandlePanningGesture={true}
        >
          {/* Animated container for border radius */}
          <Animated.View style={[styles.sheetContentContainer, sheetContainerAnimatedStyle]}>
            <BottomSheetScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <YStack gap={13} style={{ paddingHorizontal: 15, paddingTop: 10 }}>
                {/* Selected store info */}
                {selectedStore && (
                  (() => {
                    const meters = getStoreDistanceMeters(selectedStore);
                    const distanceText = meters != null ? formatDistance(meters) : null;
                    const walkMin = meters != null ? estimateWalkMinutes(meters) : null;
                    const { expiringSoonCount, soonestExpiry } = getStoreExpiryInfo(selectedStore.id);
                    const soonestExpiryText = soonestExpiry
                      ? `${soonestExpiry.getMonth() + 1}/${soonestExpiry.getDate()}`
                      : null;

                    return (
                      <Card
                        borderRadius="$6"
                        padding="$4"
                        borderColor="#e5e5e5"
                        borderWidth={1}
                        backgroundColor="white"
                        shadowColor="black"
                        shadowRadius={8}
                        shadowOffset={{ width: 0, height: 2 }}
                        shadowOpacity={0.06}
                        elevation={2}
                      >
                        <YStack gap="$3">
                          <XStack style={{ alignItems: 'center', justifyContent: 'space-between' }} gap="$3">
                            <YStack flex={1} gap="$1">
                              <Text fontSize={18} fontWeight="700" color="#000000" numberOfLines={1}>
                                {selectedStore.name}
                              </Text>
                              {!!selectedStore.address && (
                                <Text fontSize={12} color="#6b7280" numberOfLines={2}>
                                  {selectedStore.address}
                                </Text>
                              )}

                              <XStack gap={10} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                <Text fontSize={12} color="#111827" fontWeight="800">
                                  可用 {selectedStore.active_coupon_count ?? 0} 張
                                </Text>
                                {(distanceText != null && walkMin != null) ? (
                                  <Text fontSize={12} color="#6b7280">
                                    {distanceText}・步行 {walkMin} 分
                                  </Text>
                                ) : Platform.OS !== 'web' ? (
                                  <Text fontSize={12} color="#9ca3af">
                                    開啟位置後可顯示與店家的距離與步行時間，點右上角 📍 取得位置
                                  </Text>
                                ) : null}
                              </XStack>

                              {expiringSoonCount > 0 && (
                                <Text fontSize={12} color="#ef4444" fontWeight="800">
                                  有 {expiringSoonCount} 張 24 小時內到期{soonestExpiryText ? `（最早 ${soonestExpiryText}）` : ''}
                                </Text>
                              )}
                            </YStack>

                            <TouchableOpacity
                              onPress={() => {
                                setSelectedStore(null);
                                setSearchQuery('');
                              }}
                              activeOpacity={0.7}
                              style={styles.clearButton}
                            >
                              <Text style={{ color: '#111827', fontWeight: '700' }}>清除</Text>
                            </TouchableOpacity>
                          </XStack>

                          <XStack gap={10}>
                            <TouchableOpacity
                              onPress={() => expandBottomSheetFull()}
                              activeOpacity={0.8}
                              style={styles.viewCouponsButton}
                            >
                              <Text style={{ color: 'white', fontWeight: '800' }}>查看優惠</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleNavigateToStore(selectedStore)}
                              activeOpacity={0.8}
                              style={styles.navigateButton}
                            >
                              <Text style={{ color: '#000', fontWeight: '800' }}>導航前往</Text>
                            </TouchableOpacity>
                          </XStack>
                        </YStack>
                      </Card>
                    );
                  })()
                )}

                {/* Scan QR Button */}
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/easyuse/qr-claim')}
                  style={styles.scanQRButton}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>
                    掃描 QR Code 領取優惠券
                  </Text>
                </TouchableOpacity>

                {/* Coupon Cards */}
                {isLoading ? (
                  <View style={styles.centerContent}>
                    <Spinner size="large" color="#FFAD31" />
                    <Text color="#6b7280" style={{ marginTop: 16 }}>載入中…</Text>
                  </View>
                ) : error ? (
                  <View style={styles.centerContent}>
                    <Text color="#ef4444" fontSize={16}>{error}</Text>
                  </View>
                ) : filteredCoupons.length === 0 ? (
                  <View style={styles.centerContent}>
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
                        onPress={() => onCouponPress(coupon)}
                      />
                    )
                  ))
                )}

                {/* Bottom padding for scroll */}
                <View style={{ height: 20 }} />
              </YStack>
            </BottomSheetScrollView>
          </Animated.View>
        </BottomSheet>

        </View>
      </DismissKeyboardView>

      {/* Merchant Deleted Modal */}
      <MerchantDeletedModal
        isOpen={merchantDeletedModal.isOpen}
        onClose={handleMerchantDeletedModalClose}
        storeName={merchantDeletedModal.storeName}
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  searchBarContainer: {
    position: 'absolute',
    left: 15,
    right: 15,
    zIndex: 10,
  },
  searchBarContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  searchInputContainer: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  locateButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FFAD31',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 100,
  },
  bottomSheet: {
    // Above search bar (10) and locate button (100) when sheet is pulled up
    zIndex: 200,
  },
  sheetBackground: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  handleIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#d0d0d0',
    borderRadius: 3,
  },
  sheetContentContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  viewCouponsButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigateButton: {
    flex: 1,
    backgroundColor: '#ffad31',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanQRButton: {
    backgroundColor: '#ffad31',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  centerContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});

export default CouPro;
