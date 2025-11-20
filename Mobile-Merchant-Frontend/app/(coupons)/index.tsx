import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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

export default function CouponsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCoupons();
  }, []);

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

  // Filter coupons based on search query
  const filteredCoupons = coupons.filter((coupon) => {
    const matchesSearch = coupon.coupon_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
            onPress={() => {
              // TODO: Implement status filter
              console.log('Status filter pressed');
            }}
          />
          <FilterButton
            label="日期"
            onPress={() => {
              // TODO: Implement date filter
              console.log('Date filter pressed');
            }}
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

