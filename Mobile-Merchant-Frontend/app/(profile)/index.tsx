import React, { useState, useEffect, useCallback } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/constants/colors';
import { Header } from '../(coupons)/components/Header';
import { Button } from '@/components/ui';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { merchantAPI, authAPI, AuthenticationError } from '@/utils/api';
import { useAuth } from '../components/providers/AuthProvider';
import { Alert } from 'react-native';

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
  const { checkAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [profileData, statsData] = await Promise.all([
        merchantAPI.getProfile(),
        merchantAPI.getStatistics(),
      ]);
      setProfile(profileData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Failed to load profile:', error);
      // Check if it's an authentication error
      if (error instanceof AuthenticationError) {
        console.log('[Profile] Authentication error detected, redirecting to login');
        router.replace('/(auth)/login');
        return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const businessHours = profile?.store?.business_hours
    ? profile.store.business_hours.split('\n').filter((h: string) => h.trim())
    : [];

  const handleLogout = async () => {
    Alert.alert(
      '確認登出',
      '您確定要登出嗎？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '登出',
          style: 'destructive',
          onPress: async () => {
            try {
              await authAPI.logout();
              await checkAuth();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('錯誤', '登出失敗，請稍後再試');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.white}>
        <Header onLogoPress={() => router.push('/(coupons)/')} showMenu={false} />
        
        <ScrollView
          flex={1}
          paddingHorizontal="$4"
          paddingTop="$4"
          paddingBottom="$6"
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* Merchant Name Section */}
              <View style={styles.merchantNameSection}>
                <XStack alignItems="center" justifyContent="space-between" width="100%">
                  <Text fontSize={32} fontWeight="700" color={colors.textPrimary}>
                    {profile?.store?.name || '商家名稱'}
                  </Text>
                  <Button variant="primary" onPress={() => {
                    router.push('/(profile)/edit');
                  }}>
                    編輯
                  </Button>
                </XStack>
              </View>

              {/* Metrics Cards */}
              <XStack gap="$3" marginTop="$4" marginBottom="$4">
                <MetricCard label="優惠數" value={statistics?.active_coupons || 0} />
                <MetricCard label="總核銷" value={statistics?.total_redemptions || 0} />
                <MetricCard label="總曝光" value={statistics?.total_views || 0} />
              </XStack>

              {/* Merchant Information Card */}
              <View style={styles.infoCard}>
                <InfoRow label="地址" value={profile?.store?.address || '未設定'} />
                <InfoRow label="電話號碼" value={profile?.merchant?.phone || '未設定'} />
                {businessHours.length > 0 && (
                  <XStack
                    paddingVertical="$3"
                    borderBottomWidth={1}
                    borderBottomColor={colors.border}
                    alignItems="flex-start"
                  >
                    <Text fontSize="$md" fontWeight="500" color={colors.textPrimary} width={100}>
                      營業時間
                    </Text>
                    <YStack flex={1} gap="$2">
                      {businessHours.map((hours: string, index: number) => (
                        <Text key={index} fontSize="$md" color={colors.textSecondary}>
                          {hours}
                        </Text>
                      ))}
                    </YStack>
                  </XStack>
                )}
              </View>

              {/* Account Actions */}
              <YStack marginTop="$6" marginBottom="$4" gap="$3">
                {/* Delete Account Button */}
                <Button 
                  variant="outline" 
                  fullWidth 
                  onPress={() => router.push('/(profile)/delete-account')}
                  borderColor="#EF4444"
                  color="#EF4444"
                >
                  刪除帳號
                </Button>

                {/* Logout Button */}
                <Button 
                  variant="outline" 
                  fullWidth 
                  onPress={handleLogout}
                  borderColor="#FF6369"
                  color="#FF6369"
                >
                  登出帳號
                </Button>
              </YStack>
            </>
          )}
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

