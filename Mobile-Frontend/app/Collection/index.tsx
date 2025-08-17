import React, { Suspense, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRequireAuth } from '../utils/authAPI';
import Gift from './Gift';
import { filterCoupons } from './utils/couponUtils';

// Import custom hooks
import { useCoupons } from './hooks/useCoupons';
import { useDailyDraw } from './hooks/useDailyDraw';
import { useSharedCoupon } from './hooks/useSharedCoupon';
import { useSearch } from './hooks/useSearch';

// Import components
import Coupon from './components/Coupon';
import DailyDrawBanner from './components/DailyDrawBanner';
import DailyDrawModal from './components/DailyDrawModal';
import PageHeader from '../components/PageHeader';

const Collection = () => {
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
      <SafeAreaView className="bg-bg-grey flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text className="mt-4 text-lg text-gray-500">驗證身份中...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-bg-grey flex-1">
      <View className="flex-1 gap-[10px] px-[11px] pt-[35px]">
        <PageHeader
          title="專屬酷胖"
          infoPopupTitle="什麼是專屬酷胖？"
          infoPopupContent={
            <View>
              <Text className="mb-2 text-xs text-gray-700">
                「專屬酷胖」是屬於你個人帳號的優惠券，內容特別、折扣力度更大，還能分享給朋友！
              </Text>
              <View className="mb-2">
                <Text className="mb-1 text-xs text-gray-700">
                  • <Text className="font-bold">專屬帳號：</Text>
                  每人每天限抽一次，有機會獲得專屬酷胖
                </Text>
                <Text className="mb-1 text-xs text-gray-700">
                  • <Text className="font-bold">限時限量：</Text>
                  有效期限較短，必須把握時間使用
                </Text>
                <Text className="mb-1 text-xs text-gray-700">
                  • <Text className="font-bold">分享轉讓：</Text>
                  中獎後如果想要，可直接一鍵分享給朋友
                </Text>
                <Text className="mb-1 text-xs text-gray-700">
                  • <Text className="font-bold">內容特別：</Text>
                  大多比「隨取即用」折扣更大，優惠設計也更有趣
                </Text>
              </View>
              <Text className="text-xs text-gray-700">
                簡單來說，專屬酷胖是我們為你精心設計的「每日驚喜券」，讓你可以和朋友一起享受發掘優惠的樂趣並參與、分享，增添生活樂趣。
              </Text>
            </View>
          }
          showSearch={true}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onClearSearch={clearSearch}
          navbarProps={{ atCollection: true }}
          sourcePage="/Collection"
        />

        <FlatList
          data={filteredCoupons}
          renderItem={renderCouponItem}
          keyExtractor={(item) => item.id?.toString() || `item-${Math.random()}`}
          contentContainerStyle={{ padding: 19, gap: 25 }}
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
            <View style={{ gap: 25 }}>
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
            </View>
          }
          ListEmptyComponent={
            <View className="flex w-full items-center justify-center p-10">
              {isLoading ? (
                <>
                  <ActivityIndicator size="large" color="#FFAD31" />
                  <Text className="mt-4 text-lg text-gray-500">載入中...</Text>
                </>
              ) : error ? (
                <Text className="text-center text-red-500">{error}</Text>
              ) : (
                <Text className="text-center text-gray-500">目前沒有可用的專屬優惠券。</Text>
              )}
            </View>
          }
        />

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
      </View>
    </SafeAreaView>
  );
};

// Wrap the client component with Suspense in the default page export
const CollectionPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Collection />
    </Suspense>
  );
};

export default CollectionPage;
