import React, { useCallback } from 'react';
import { RefreshControl, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { 
  YStack, 
  XStack, 
  ScrollView, 
  Text, 
  Spinner,
  View,
  Input,
  H4
} from 'tamagui';
import { AlignJustify, Search, X } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import TabsFooter from '../components/TabsFooter';
import ErrorBoundary from '../components/ErrorBoundary';
import { useRequireAuth } from '../utils/authAPI';
import Gift from './Gift';
import { filterCoupons } from './utils/couponUtils';

// Import custom hooks
import { useCoupons } from './hooks/useCoupons';
import { useDailyDraw } from './hooks/useDailyDraw';
import { useSharedCoupon } from './hooks/useSharedCoupon';
import { useSearch } from './hooks/useSearch';

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

// Import components
import Coupon from './components/Coupon';
import DailyDrawBanner from './components/DailyDrawBanner';
import DailyDrawModal from './components/DailyDrawModal';

const Collection = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Use our auth hook to protect this route
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  // Use custom hooks
  const { searchQuery, handleSearchChange, clearSearch } = useSearch();
  const { coupons, isLoading, error, fetchCoupons } = useCoupons(isAuthenticated, authLoading);
  const {
    showDailyDraw,
    setShowDailyDraw,
    dailyDrawResult,
    isDailyDrawLoading,
    hasDailyDrawn,
    availableTemplates,
    handleDailyDraw,
    closeDailyDrawWithSuccess,
  } = useDailyDraw(isAuthenticated, authLoading, fetchCoupons);
  const { shareToken, sharedCoupon, showSharedGift, handleGiftAccepted } =
    useSharedCoupon(fetchCoupons);

  // Filter coupons based on search query
  const filteredCoupons = filterCoupons(coupons, searchQuery);

  // Refresh handler
  const onRefresh = useCallback(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // Menu handler
  const onMenuIconClick = () => {
    router.push('/OptionsMenu');
  };

  // Render coupon item
  const renderCouponItem = useCallback(
    ({ item }: { item: any }) => (
      <Coupon
        key={item.id}
        couponName={item.couponName}
        storeName={item.storeName}
        expiryDate={item.expiryDate}
        id={item.id}
        imageUrl={item.imageUrl}
      />
    ),
    []
  );

  // Show loading state if auth is still loading
  if (authLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" color="#FFAD31" />
          <Text marginTop="$4" fontSize="$6" color="#6b7280">驗證身份中...</Text>
        </YStack>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
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
                專屬酷胖
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
            <Search color='#a8a8a8' />
            <Input
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="搜尋優惠券..."
              style={{ flex: 1 }}
              unstyled
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} activeOpacity={0.7}>
                <X color='#a8a8a8'></X>
              </TouchableOpacity>
            )}
          </XStack>
        </YStack>

        <View flex={1} style={{ backgroundColor: '#f0f0f0' }}>
          <FlatList
            data={filteredCoupons}
            renderItem={renderCouponItem}
            keyExtractor={(item) => item.id?.toString() || `item-${Math.random()}`}
            contentContainerStyle={{ paddingHorizontal: 13, paddingVertical: 30, gap: 13 }}
            showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              colors={['#FFAD31']}
              tintColor="#FFAD31"
            />
          }
          ListHeaderComponent={
            <YStack gap={25}>
              {/* Daily Draw Banner */}
              {!hasDailyDrawn && !showSharedGift && (
                <DailyDrawBanner onClick={() => setShowDailyDraw(true)} />
              )}

              {/* Show shared coupon as Gift if present */}
              {showSharedGift && sharedCoupon && (
                <Gift
                  token={shareToken || undefined}
                  couponInfo={{
                    id: sharedCoupon.coupon_id,
                    name: sharedCoupon.coupon_name,
                    fromUser: sharedCoupon.from_user_email,
                  }}
                  ReceiveType="領取"
                  onAccepted={handleGiftAccepted}
                />
              )}
            </YStack>
          }
          ListEmptyComponent={
            <YStack width="100%" alignItems="center" justifyContent="center" padding="$6">
              {isLoading ? (
                <>
                  <Spinner size="large" color="#FFAD31" />
                  <Text marginTop="$4" fontSize="$6" color="#6b7280">載入中...</Text>
                </>
              ) : error ? (
                <Text textAlign="center" color="#ef4444">{error}</Text>
              ) : (
                <Text textAlign="center" color="#6b7280">目前沒有可用的專屬優惠券。</Text>
              )}
            </YStack>
          }
          />
        </View>

        {/* Daily Draw Modal */}
        <DailyDrawModal
          isOpen={showDailyDraw}
          onClose={() => setShowDailyDraw(false)}
          onDraw={handleDailyDraw}
          onDrawComplete={closeDailyDrawWithSuccess}
          result={dailyDrawResult}
          isLoading={isDailyDrawLoading}
          templatesAvailable={availableTemplates.length}
        />

        {/* Bottom Navigation */}
        <TabsFooter
          activeTab="collection"
          onHomePress={() => router.push('/EasyUse')}
          onCollectionPress={() => router.push('/Collection')}
          onStatisticsPress={() => router.push('/Statistics')}
        />
      </YStack>
    </ErrorBoundary>
  );
};

export default Collection;
