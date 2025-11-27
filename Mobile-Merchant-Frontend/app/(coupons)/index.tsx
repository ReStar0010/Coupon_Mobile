import React, { useState, useEffect, useCallback } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Alert } from 'react-native';
import { colors } from '@/constants/colors';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { FilterButton } from './components/FilterButton';
import { CouponCard } from './components/CouponCard';
import { AddButton } from './components/AddButton';
import { merchantAPI } from '@/utils/api';

export interface Coupon {
  id: number;
  coupon_name: string;
  start_date: string;
  end_date: string;
  redemption_count?: number;
  remaining_quantity?: number;
  total_quantity?: number;
  is_active?: boolean;
}

type CouponStatus = 'all' | 'active' | 'ended' | 'upcoming' | 'inactive';
type DateFilter = 'all' | 'today' | 'thisWeek' | 'thisMonth';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CouponStatus>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCoupons = async () => {
    try {
      setIsLoading(true);
      const data = await merchantAPI.listTemplates();
      setCoupons(data || []);
    } catch (error) {
      console.error('Failed to load coupons:', error);
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

  // Filter coupons based on search query, status, and date
  const filteredCoupons = coupons.filter((coupon) => {
    // Search filter
    const matchesSearch = coupon.coupon_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.white}>
        <Header 
          onMenuPress={() => router.push('/(profile)/')}
        />
        <ScrollView
        flex={1}
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$6"
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜尋優惠券..."
        />

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
            filteredCoupons.map((coupon) => (
              <CouponCard
                key={coupon.id}
                coupon={{
                  id: String(coupon.id),
                  title: coupon.coupon_name,
                  startDate: new Date(coupon.start_date).toLocaleDateString('zh-TW'),
                  endDate: new Date(coupon.end_date).toLocaleDateString('zh-TW'),
                  redemptionCount: coupon.redemption_count || 0,
                }}
                onEdit={() => {
                  router.push(`/(coupons)/edit?id=${coupon.id}`);
                }}
              />
            ))
          )}
        </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}

