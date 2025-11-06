import React from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Header } from './components/Header';
import { Button } from '@/components/ui';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface MetricCardProps {
  label: string;
  value: string | number;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Text fontSize="$sm" color={colors.textSecondary} marginBottom="$2">
        {label}
      </Text>
      <Text fontSize={28} fontWeight="700" color={colors.textPrimary}>
        {value}
      </Text>
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <XStack
      paddingVertical="$3"
      borderBottomWidth={1}
      borderBottomColor={colors.border}
      alignItems="flex-start"
    >
      <Text fontSize="$md" fontWeight="500" color={colors.textPrimary} width={100}>
        {label}
      </Text>
      <Text fontSize="$md" color={colors.textSecondary} flex={1}>
        {value}
      </Text>
    </XStack>
  );
}

export default function MerchantProfileScreen() {
  const router = useRouter();

  const businessHours = [
    '星期一 公休',
    '星期二 10:00-21:30',
    '星期三 10:00-21:30',
    '星期四 10:00-21:30',
    '星期五 10:00-21:30',
    '星期六 12:00-18:00',
    '星期日 12:00-18:00',
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.white}>
        <Header onLogoPress={() => router.push('/(coupons)/')} />
        
        <ScrollView
          flex={1}
          paddingHorizontal="$4"
          paddingTop="$4"
          paddingBottom="$6"
          showsVerticalScrollIndicator={false}
        >
          {/* Merchant Name Section */}
          <View style={styles.merchantNameSection}>
            <XStack alignItems="center" justifyContent="space-between" width="100%">
              <Text fontSize={32} fontWeight="700" color={colors.textPrimary}>
                政大茶亭
              </Text>
              <Button variant="primary" onPress={() => {
                router.push('/(coupons)/profile-edit');
              }}>
                編輯
              </Button>
            </XStack>
          </View>

          {/* Metrics Cards */}
          <XStack gap="$3" marginTop="$4" marginBottom="$4">
            <MetricCard label="優惠數" value="4" />
            <MetricCard label="總核銷" value="39" />
            <MetricCard label="總曝光" value="157" />
          </XStack>

          {/* Merchant Information Card */}
          <View style={styles.infoCard}>
            <InfoRow label="地址" value="Ricky Lu" />
            <InfoRow label="電話號碼" value="02 8661 0884" />
            <YStack paddingVertical="$3">
              <Text fontSize="$md" fontWeight="500" color={colors.textPrimary} marginBottom="$3">
                營業時間
              </Text>
              <YStack gap="$2">
                {businessHours.map((hours, index) => (
                  <Text key={index} fontSize="$md" color={colors.textSecondary}>
                    {hours}
                  </Text>
                ))}
              </YStack>
            </YStack>
          </View>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  merchantNameSection: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

