import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { YStack, Text, Spinner, View } from 'tamagui';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// import * as Sentry from '@sentry/react-native';
import ScreenErrorFallback from '@/app/components/ScreenErrorFallback';
import AppHeader from '@/app/components/shared/AppHeader';
import { useRequireAuth } from '@/app/utils/authAPI';
import Gift from './Gift';
import { filterCoupons, withdrawPublicShare } from './utils/couponUtils';
import { COLORS } from '@/app/constants/theme';
import { useDismissedStores } from '@/app/components/providers/DismissedStoresProvider';
import { useBlockedMerchants } from '@/app/components/providers/BlockedMerchantsProvider';
import MerchantDeletedModal from '@/app/components/MerchantDeletedModal';
import { useFocusEffect } from '@react-navigation/native';
import { consumeCollectionDirty } from '@/app/utils/collectionRefresh';

import { useCoupons } from './hooks/useCoupons';
import { useDailyDraw } from './hooks/useDailyDraw';
import { useSharedCoupon } from './hooks/useSharedCoupon';
import { useSearch } from './hooks/useSearch';
import { useMyPublicShares } from './hooks/useMyPublicShares';
import { usePlatformVouchers } from './hooks/usePlatformVouchers';
import { useTags } from './hooks/useTags';

import Coupon from './components/Coupon';
import DailyDrawBanner from './components/DailyDrawBanner';
import DailyDrawModal from './components/DailyDrawModal';
import MyPlatformVouchers from './components/MyPlatformVouchers';
import { FilterBar } from './components/FilterBar';
import type { CouponType } from './utils/types';
import { useCollectionFilters } from './hooks/useCollectionFilters';

/** List item: normal coupon or in-pool share (has shareIdInPool) */
type CollectionListItem = CouponType & { shareIdInPool?: number };

interface CouponItemProps {
  item: CollectionListItem;
  onMerchantDeleted?: (storeName: string, storeId: number) => void;
  onWithdrawFromPool?: (shareId: number) => void;
}

const CouponItem: React.FC<CouponItemProps> = React.memo(
  ({ item, onMerchantDeleted, onWithdrawFromPool }) => (
    <Coupon
      key={item.id ?? item.shareIdInPool}
      couponName={item.couponName}
      storeName={item.storeName}
      expiryDate={item.expiryDate}
      id={item.id}
      imageUrl={item.imageUrl}
      tags={item.tags}
      storeId={item.storeId}
      merchantDeleted={item.merchantDeleted}
      onMerchantDeleted={onMerchantDeleted}
      shareIdInPool={item.shareIdInPool}
      onWithdrawFromPool={onWithdrawFromPool}
      inPoolLabel="交換池中"
    />
  ),
);

CouponItem.displayName = 'CouponItem';

const LoadingState: React.FC = React.memo(() => (
  <YStack width="100%" style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <Spinner size="large" color={COLORS.primary} />
    <Text style={{ marginTop: 16 }} fontSize="$6" color={COLORS.text.secondary}>
      載入中...
    </Text>
  </YStack>
));

LoadingState.displayName = 'LoadingState';

interface ErrorStateProps {
  error: string;
}

const ErrorState: React.FC<ErrorStateProps> = React.memo(({ error }) => (
  <YStack width="100%" style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <Text style={{ textAlign: 'center' }} color={COLORS.text.error}>
      {error}
    </Text>
  </YStack>
));

ErrorState.displayName = 'ErrorState';

const EmptyState: React.FC = React.memo(() => (
  <YStack width="100%" style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <Text style={{ textAlign: 'center' }} color={COLORS.text.secondary}>
      目前沒有可用的專屬優惠券。
    </Text>
  </YStack>
));

EmptyState.displayName = 'EmptyState';

const Collection: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { dismissStore, isStoreDismissed } = useDismissedStores();
  const { isStoreBlocked } = useBlockedMerchants();

  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const { searchQuery, handleSearchChange, clearSearch } = useSearch();
  const { coupons, isLoading, error, fetchCoupons } = useCoupons(isAuthenticated, authLoading);

  // Merchant deleted modal state
  const [merchantDeletedModal, setMerchantDeletedModal] = useState<{
    isOpen: boolean;
    storeName: string;
    storeId: number | null;
  }>({ isOpen: false, storeName: '', storeId: null });
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
  const {
    publicShares,
    isLoading: sharesLoading,
    fetchPublicShares,
  } = useMyPublicShares(isAuthenticated, authLoading);
  const {
    vouchers: platformVouchers,
    isLoading: vouchersLoading,
    fetchVouchers,
  } = usePlatformVouchers(isAuthenticated, authLoading);
  const { tags } = useTags(isAuthenticated);
  const merchants = useMemo(() => {
    const merchantSet = new Set<string>();
    coupons.forEach((coupon) => {
      if (coupon.storeName) merchantSet.add(coupon.storeName);
    });
    return Array.from(merchantSet).sort();
  }, [coupons]);
  const filters = useCollectionFilters({ tags, merchants });

  const {
    expiryFilter,
    selectedMerchant,
    selectedTagDisplayNames,
    tagFilterLabel,
    expiryFilterLabel,
    merchantFilterLabel,
    openTagPicker,
    openExpiryPicker,
    openMerchantPicker,
  } = filters;

  const activeCoupons = useMemo(
    () =>
      coupons.filter(
        (coupon) =>
          !coupon.storeId || (!isStoreDismissed(coupon.storeId) && !isStoreBlocked(coupon.storeId)),
      ),
    [coupons, isStoreDismissed, isStoreBlocked],
  );

  const baseFiltered = useMemo(
    () =>
      filterCoupons(
        activeCoupons,
        searchQuery,
        selectedTagDisplayNames,
        expiryFilter,
        selectedMerchant,
      ),
    [activeCoupons, searchQuery, selectedTagDisplayNames, expiryFilter, selectedMerchant],
  );

  const pendingPoolItems = useMemo((): CollectionListItem[] => {
    const pending = publicShares.filter((s) => s.status === 'pending');
    const placeholderDate = new Date(0);
    return pending.map((s) => ({
      id: s.coupon_id,
      couponName: s.coupon_name,
      storeName: s.store_name ?? '',
      description: '',
      startDate: placeholderDate,
      expiryDate: placeholderDate,
      couponType: 'exclusive' as const,
      imageUrl: s.image_url ?? undefined,
      shareIdInPool: s.share_id,
    }));
  }, [publicShares]);

  const filteredCoupons = useMemo(
    () => [...baseFiltered, ...pendingPoolItems],
    [baseFiltered, pendingPoolItems],
  );

  const handleWithdrawFromPool = useCallback(
    async (shareId: number) => {
      try {
        await withdrawPublicShare(shareId);
        await Promise.all([fetchCoupons(), fetchPublicShares()]);
      } catch (err) {
        console.error('Withdraw from pool failed:', err);
      }
    },
    [fetchCoupons, fetchPublicShares],
  );

  const onRefresh = useCallback(() => {
    fetchCoupons();
    fetchPublicShares();
    fetchVouchers();
  }, [fetchCoupons, fetchPublicShares, fetchVouchers]);

  // Tabs preserve state for performance; refresh only when explicitly invalidated.
  useFocusEffect(
    useCallback(() => {
      if (consumeCollectionDirty()) {
        onRefresh();
      }
    }, [onRefresh]),
  );

  const handleOpenDailyDraw = useCallback(() => {
    setShowDailyDraw(true);
  }, [setShowDailyDraw]);

  const handleCloseDailyDraw = useCallback(() => {
    setShowDailyDraw(false);
  }, [setShowDailyDraw]);

  // Handle merchant deleted modal
  const handleMerchantDeleted = useCallback((storeName: string, storeId: number) => {
    setMerchantDeletedModal({ isOpen: true, storeName, storeId });
  }, []);

  const handleMerchantDeletedModalClose = useCallback(async () => {
    if (merchantDeletedModal.storeId) {
      await dismissStore(merchantDeletedModal.storeId);
    }
    setMerchantDeletedModal({ isOpen: false, storeName: '', storeId: null });
  }, [merchantDeletedModal.storeId, dismissStore]);

  const renderCouponItem = useCallback(
    ({ item }: { item: CollectionListItem }) => (
      <CouponItem
        item={item}
        onMerchantDeleted={handleMerchantDeleted}
        onWithdrawFromPool={handleWithdrawFromPool}
      />
    ),
    [handleMerchantDeleted, handleWithdrawFromPool],
  );

  const keyExtractor = useCallback(
    (item: CollectionListItem) =>
      item.shareIdInPool != null
        ? `pool-${item.shareIdInPool}`
        : (item.id?.toString() ?? `item-${Math.random()}`),
    [],
  );

  const ListHeaderComponent = useMemo(
    () => (
      <YStack gap={25}>
        <MyPlatformVouchers vouchers={platformVouchers} isLoading={vouchersLoading} />

        {!hasDailyDrawn && !showSharedGift && <DailyDrawBanner onClick={handleOpenDailyDraw} />}

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
    ),
    [
      platformVouchers,
      vouchersLoading,
      hasDailyDrawn,
      showSharedGift,
      sharedCoupon,
      shareToken,
      handleGiftAccepted,
      handleOpenDailyDraw,
    ],
  );

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState error={error} />;
    return <EmptyState />;
  }, [isLoading, error]);

  if (authLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <YStack flex={1} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 16 }} fontSize="$6" color={COLORS.text.secondary}>
            驗證身份中...
          </Text>
        </YStack>
      </SafeAreaView>
    );
  }

  return (
    // <Sentry.ErrorBoundary
    //   fallback={({ error, componentStack, resetError }) => (
    //     <ScreenErrorFallback
    //       error={error as Error}
    //       componentStack={componentStack}
    //       resetError={resetError}
    //     />
    //   )}
    //   beforeCapture={(scope) => {
    //     scope.setTag('boundary', 'collection-screen');
    //     scope.setTag('boundary_type', 'screen');
    //   }}
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <YStack flex={1}>
        <AppHeader
          title="專屬酷胖"
          showSearch
          searchQuery={searchQuery}
          searchPlaceholder="搜尋優惠券..."
          onSearchChange={handleSearchChange}
          onSearchClear={clearSearch}
          topInset={insets.top}
        />

        <FilterBar
          tagFilterLabel={tagFilterLabel}
          expiryFilterLabel={expiryFilterLabel}
          merchantFilterLabel={merchantFilterLabel}
          onTagPress={openTagPicker}
          onExpiryPress={openExpiryPicker}
          onMerchantPress={openMerchantPicker}
        />

        <View flex={1} style={{ backgroundColor: COLORS.backgroundLight }}>
          <FlatList
            data={filteredCoupons}
            renderItem={renderCouponItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={{
              paddingHorizontal: 13,
              paddingVertical: 30,
              gap: 13,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
            ListHeaderComponent={ListHeaderComponent}
            ListEmptyComponent={ListEmptyComponent}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={6}
          />
        </View>

        <DailyDrawModal
          isOpen={showDailyDraw}
          onClose={handleCloseDailyDraw}
          onDraw={handleDailyDraw}
          onDrawComplete={closeDailyDrawWithSuccess}
          result={dailyDrawResult}
          isLoading={isDailyDrawLoading}
          templatesAvailable={availableTemplates.length}
        />

        {/* Merchant Deleted Modal */}
        <MerchantDeletedModal
          isOpen={merchantDeletedModal.isOpen}
          onClose={handleMerchantDeletedModalClose}
          storeName={merchantDeletedModal.storeName}
        />
      </YStack>
    </>
    // </Sentry.ErrorBoundary>
  );
};

export default Collection;
