import React, { useState } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { FilterButton } from './components/FilterButton';
import { CouponCard } from './components/CouponCard';
import { AddButton } from './components/AddButton';

export interface Coupon {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  redemptionCount: number;
}

export default function CouponsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  // Sample coupon data
  const coupons: Coupon[] = [
    {
      id: '1',
      title: '來店消費即可折 5 元',
      startDate: '2024/07/27',
      endDate: '2024/9/30',
      redemptionCount: 32,
    },
  ];

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
          {coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onEdit={() => {
                router.push(`/(coupons)/edit?id=${coupon.id}`);
              }}
            />
          ))}
        </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}

