/**
 * Privacy Policy Screen
 * UGC Compliance (Apple Guideline 1.2) - User Story 5
 *
 * Displays privacy policy accessible without login (within 2 taps).
 */

import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/app/constants/token';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  primary: tokens.color.primary,
  background: tokens.color.background,
  border: tokens.color.border,
  textPrimary: tokens.color.textPrimary,
  textSecondary: tokens.color.textSecondary,
};

interface PrivacyPolicyData {
  title: string;
  content: string;
  last_updated: string;
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [policyData, setPolicyData] = useState<PrivacyPolicyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPrivacyPolicy();
  }, []);

  const loadPrivacyPolicy = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch privacy policy from API (no auth required)
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/privacy-policy/`);
      const data = await response.json();

      setPolicyData(data);
    } catch (err: any) {
      console.error('Failed to load privacy policy:', err);
      setError('無法載入隱私政策，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        backgroundColor={colors.primary}
        alignItems="center"
        borderBottomWidth={1}
        borderBottomColor={colors.border}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text fontSize="18" fontWeight="600" color="#fff" marginLeft="$2">
          隱私政策
        </Text>
      </XStack>

      {/* Content */}
      <ScrollView flex={1} backgroundColor={colors.background}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text fontSize={14} color={colors.textSecondary} marginTop="$4">
              載入中...
            </Text>
          </YStack>
        ) : error ? (
          <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
            <Ionicons name="alert-circle" size={48} color={colors.error} />
            <Text fontSize="$md" color={colors.textPrimary} marginTop="$4" textAlign="center">
              {error}
            </Text>
            <TouchableOpacity onPress={loadPrivacyPolicy} style={styles.retryButton}>
              <Text fontSize={14} color={colors.primary} fontWeight="600">
                重試
              </Text>
            </TouchableOpacity>
          </YStack>
        ) : policyData ? (
          <YStack padding="$4" gap="$4">
            {/* Last Updated */}
            <YStack
              backgroundColor="#f8f9fa"
              padding="$3"
              borderRadius="$3"
              borderWidth={1}
              borderColor={colors.border}>
              <Text fontSize={14} color={colors.textSecondary}>
                最後更新：
                {new Date(policyData.last_updated).toLocaleDateString('zh-TW', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </YStack>

            {/* Policy Content */}
            <YStack
              backgroundColor="#fff"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor={colors.border}>
              <Text fontSize="18" fontWeight="600" color={colors.textPrimary} marginBottom="$3">
                {policyData.title}
              </Text>
              <Text fontSize={14} color={colors.textPrimary} lineHeight={24}>
                {policyData.content}
              </Text>
            </YStack>

            {/* Contact Section */}
            <YStack
              backgroundColor="#fff"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor={colors.border}
              gap="$2">
              <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
                聯絡我們
              </Text>
              <Text fontSize={14} color={colors.textSecondary} lineHeight={20}>
                如對本隱私政策有任何疑問，請聯繫：
              </Text>
              <Text fontSize={14} color={colors.primary} fontWeight="500">
                coupro707@gmail.com
              </Text>
            </YStack>
          </YStack>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: 4,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
