import React, { useState, useEffect, useCallback } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { FilterButton } from './components/FilterButton';
import { CouponCard } from './components/CouponCard';
import { AddButton } from './components/AddButton';
import { BarcodeVerificationButton } from './components/BarcodeVerificationButton';
import { QRCodeModal } from './components/QRCodeModal';
import { merchantAPI, AuthenticationError } from '@/utils/api';

export interface Coupon {
  id: number;
  coupon_name: string;
  start_date: string;
  end_date: string;
  redemption_count?: number;
  remaining_quantity?: number;
  total_quantity?: number;
  is_active?: boolean;
  is_sold_out?: boolean;
}

type CouponStatus = 'all' | 'active' | 'ended' | 'upcoming' | 'inactive';
type DateFilter = 'all' | 'today' | 'thisWeek' | 'thisMonth';
/** 優惠類型：全部 / 隨取即用 (total_quantity=0) / 專屬優惠 (total_quantity>0) */
type TypeFilter = 'all' | 'store' | 'exclusive';

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'store', label: '隨取即用' },
  { value: 'exclusive', label: '專屬優惠' },
];

const STATUS_OPTIONS: { value: CouponStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '進行中' },
  { value: 'ended', label: '已結束' },
  { value: 'upcoming', label: '未開始' },
  { value: 'inactive', label: '已停用' },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'thisWeek', label: '本週' },
  { value: 'thisMonth', label: '本月' },
];

export default function CouponsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<CouponStatus>('active');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const loadCoupons = async () => {
    try {
      setIsLoading(true);
      const data = await merchantAPI.listTemplates();
      setCoupons(data || []);
    } catch (error) {
      console.error('Failed to load coupons:', error);
      // Check if it's an authentication error
      if (error instanceof AuthenticationError) {
        console.log('[Coupons] Authentication error detected, redirecting to login');
        router.replace('/(auth)/login');
        return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load coupons on initial mount
  useEffect(() => {
    loadCoupons();
  }, []);

  // Refresh coupons when screen comes into focus (e.g., returning from edit page)
  useFocusEffect(
    useCallback(() => {
      loadCoupons();
    }, [])
  );

  // Get coupon status based on dates and is_active
  const getCouponStatus = (coupon: Coupon): CouponStatus => {
    const now = new Date();
    const startDate = new Date(coupon.start_date);
    const endDate = new Date(coupon.end_date);

    if (!coupon.is_active) {
      return 'inactive';
    }

    if (endDate < now) {
      return 'ended';
    }

    if (startDate > now) {
      return 'upcoming';
    }

    if (startDate <= now && endDate >= now) {
      return 'active';
    }

    return 'ended';
  };

  // Check if coupon matches date filter
  const matchesDateFilter = (coupon: Coupon, filter: DateFilter): boolean => {
    if (filter === 'all') return true;

    const now = new Date();
    const startDate = new Date(coupon.start_date);
    const endDate = new Date(coupon.end_date);

    // Reset time to start of day for comparison
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    switch (filter) {
      case 'today':
        // Check if start_date or end_date is today
        return (
          (startDate >= todayStart && startDate < todayEnd) ||
          (endDate >= todayStart && endDate < todayEnd) ||
          (startDate <= todayStart && endDate >= todayEnd)
        );

      case 'thisWeek': {
        // Get start of week (Monday)
        const weekStart = new Date(todayStart);
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
        weekStart.setDate(weekStart.getDate() - diff);

        // Get end of week (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        // Check if coupon overlaps with this week
        return (
          (startDate >= weekStart && startDate < weekEnd) ||
          (endDate >= weekStart && endDate < weekEnd) ||
          (startDate <= weekStart && endDate >= weekEnd)
        );
      }

      case 'thisMonth': {
        // Get start of month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // Get start of next month
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Check if coupon overlaps with this month
        return (
          (startDate >= monthStart && startDate < monthEnd) ||
          (endDate >= monthStart && endDate < monthEnd) ||
          (startDate <= monthStart && endDate >= monthEnd)
        );
      }

      default:
        return true;
    }
  };

  // Filter coupons based on search query, type, status, and date
  const filteredCoupons = coupons.filter((coupon) => {
    // Search filter
    const matchesSearch = coupon.coupon_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Type filter: 隨取即用 = total_quantity 0, 專屬優惠 = total_quantity > 0
    if (typeFilter !== 'all') {
      const isExclusive = (coupon.total_quantity ?? 0) > 0;
      if (typeFilter === 'store' && isExclusive) return false;
      if (typeFilter === 'exclusive' && !isExclusive) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const couponStatus = getCouponStatus(coupon);
      if (couponStatus !== statusFilter) return false;
    }

    // Date filter
    if (!matchesDateFilter(coupon, dateFilter)) return false;

    return true;
  });

  // Handle status filter selection
  const handleStatusFilterPress = () => {
    Alert.alert(
      '選擇狀態',
      '請選擇要篩選的狀態',
      [
        ...STATUS_OPTIONS.map((option) => ({
          text: option.label,
          onPress: () => setStatusFilter(option.value),
        })),
        {
          text: '取消',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  // Handle date filter selection
  const handleDateFilterPress = () => {
    Alert.alert(
      '選擇日期',
      '請選擇要篩選的日期範圍',
      [
        ...DATE_OPTIONS.map((option) => ({
          text: option.label,
          onPress: () => setDateFilter(option.value),
        })),
        {
          text: '取消',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  // Get display label for status filter
  const getStatusFilterLabel = (): string | null => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === statusFilter);
    return option && option.value !== 'all' ? option.label : null;
  };

  // Get display label for date filter
  const getDateFilterLabel = (): string | null => {
    const option = DATE_OPTIONS.find((opt) => opt.value === dateFilter);
    return option && option.value !== 'all' ? option.label : null;
  };

  // Handle barcode verification button press
  const handleBarcodeVerificationPress = async () => {
    try {
      setIsGeneratingCode(true);
      const response = await merchantAPI.generateUnifiedRedemptionCode();
      setQrCodeValue(response.unified_redeem_code);
      setIsQRCodeModalOpen(true);
    } catch (error: any) {
      console.error('Failed to generate unified redemption code:', error);
      Alert.alert('錯誤', error?.message || '無法生成統一核銷碼，請稍後再試');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top', 'bottom']}>
      <YStack flex={1} backgroundColor={colors.white}>
        <Header 
          onMenuPress={() => router.push('/(profile)/')}
        />
        <ScrollView
        flex={1}
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$20"
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜尋優惠券..."
        />

        {/* Type Tabs: 全部 | 隨取即用 | 專屬優惠 (風格與狀態/日期 FilterButton 一致) */}
        <XStack marginTop="$3" gap="$2">
          {TYPE_OPTIONS.map((option) => {
            const isSelected = typeFilter === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setTypeFilter(option.value)}
                activeOpacity={0.7}
                style={styles.tabTouchable}
              >
                <XStack
                  flex={1}
                  paddingVertical="$2.5"
                  paddingHorizontal="$3"
                  justifyContent="center"
                  alignItems="center"
                  backgroundColor={isSelected ? colors.primary : colors.background}
                  borderWidth={1}
                  borderColor={isSelected ? colors.primary : colors.border}
                  borderRadius="$4"
                >
                  <Text
                    fontSize="$md"
                    fontWeight="600"
                    color={isSelected ? colors.white : colors.textPrimary}
                  >
                    {option.label}
                  </Text>
                </XStack>
              </TouchableOpacity>
            );
          })}
        </XStack>

        {/* Filter Section */}
        <XStack gap="$2" marginTop="$3" marginBottom="$4" alignItems="center">
          <FilterButton
            label="狀態"
            selectedValue={getStatusFilterLabel()}
            onPress={handleStatusFilterPress}
          />
          <FilterButton
            label="日期"
            selectedValue={getDateFilterLabel()}
            onPress={handleDateFilterPress}
          />
          <XStack flex={1} />
          <AddButton
            onPress={() => {
              router.push('/(coupons)/edit');
            }}
          />
        </XStack>

        {/* Coupon Cards */}
        <YStack gap="$3">
          {isLoading ? (
            <Text textAlign="center" color={colors.textSecondary} padding="$4">
              載入中...
            </Text>
          ) : filteredCoupons.length === 0 ? (
            <Text textAlign="center" color={colors.textSecondary} padding="$4">
              尚無優惠券
            </Text>
          ) : (
            filteredCoupons.map((coupon) => {
              // Collections-only: in this app, total_quantity > 0 indicates "專屬優惠" (Collections).
              // Other types (e.g., 隨取即用) should NOT show Sold Out UI.
              const isCollectionsType = (coupon.total_quantity ?? 0) > 0;

              return (
                <CouponCard
                  key={coupon.id}
                  coupon={{
                    id: String(coupon.id),
                    title: coupon.coupon_name,
                    startDate: new Date(coupon.start_date).toLocaleDateString('zh-TW'),
                    endDate: new Date(coupon.end_date).toLocaleDateString('zh-TW'),
                    redemptionCount: coupon.redemption_count || 0,
                    enableSoldOutUI: isCollectionsType,
                    remainingQuantity: isCollectionsType ? coupon.remaining_quantity : undefined,
                    isExclusiveCoupon: isCollectionsType,
                  }}
                  onEdit={() => {
                    router.push(`/(coupons)/edit?id=${coupon.id}`);
                  }}
                />
              );
            })
          )}
        </YStack>
        </ScrollView>
        
        {/* Barcode Verification Button */}
        <YStack
          position="absolute"
          bottom={insets.bottom}
          left={0}
          right={0}
          paddingHorizontal="$4"
          paddingBottom="$4"
          backgroundColor={colors.white}
        >
          <BarcodeVerificationButton 
            onPress={handleBarcodeVerificationPress} 
            isLoading={isGeneratingCode}
          />
        </YStack>
      </YStack>
      
      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQRCodeModalOpen}
        onClose={() => setIsQRCodeModalOpen(false)}
        qrValue={qrCodeValue}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabTouchable: {
    flex: 1,
  },
});

