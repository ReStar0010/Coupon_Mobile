/**
 * Content Guidelines Screen
 * UGC Compliance (Apple Guideline 1.2) - User Story 6
 *
 * Displays content guidelines and penalty information for merchants.
 * Accessible anytime from merchant Settings menu.
 */

import React, { useState, useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { fetchAPI, parseResponse } from '@/utils/api';

interface ContentGuideline {
  category: string;
  description: string;
  examples: string[];
}

interface PenaltyTier {
  threshold: string;
  consequence: string;
}

interface GuidelinesData {
  title: string;
  introduction: string;
  prohibited_content: ContentGuideline[];
  reporting_process: string;
  penalties: PenaltyTier[];
  appeal_process: string;
}

// Backend API response structure
interface BackendGuidelinesResponse {
  prohibited_content: ContentGuideline[];
  penalties: {
    violation_count: string;
    consequence: string;
  }[];
  support_contact?: string;
}

export default function ContentGuidelinesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [guidelinesData, setGuidelinesData] = useState<GuidelinesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuidelines();
  }, []);

  const loadGuidelines = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch content guidelines from API (public endpoint, no auth required)
      const response = await fetchAPI('/content-guidelines/', {
        method: 'GET',
        requireAuth: false,
      });

      // Parse response
      const backendData: BackendGuidelinesResponse = await parseResponse(response);

      // Transform backend data to frontend format
      const transformedData: GuidelinesData = {
        title: 'CouPro 內容規範',
        introduction:
          '為了維護平台的良好環境，請確保您上傳的內容符合以下規範。違反規範的內容將被移除，並可能導致帳號受到限制。',
        prohibited_content: backendData.prohibited_content || [],
        reporting_process:
          '使用者可以透過內容頁面的「檢舉」功能，向平台舉報不當內容。我們會在 24 小時內審查所有檢舉。',
        penalties:
          backendData.penalties?.map((penalty) => ({
            threshold: penalty.violation_count,
            consequence: penalty.consequence,
          })) || [],
        appeal_process: '如果您認為內容被錯誤移除，可以透過 coupro707@gmail.com 聯繫我們進行申訴。',
      };

      setGuidelinesData(transformedData);
    } catch (err: any) {
      console.error('Failed to load content guidelines:', err);
      Sentry.captureException(err, {
        data: { context: 'merchant.contentGuidelines.loadGuidelines' },
      });
      setError('無法載入內容規範，請稍後再試');
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
        borderBottomColor={colors.border}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text fontSize={18} fontWeight="600" color="#fff" marginLeft="$2">
          內容規範
        </Text>
      </XStack>

      {/* Content */}
      <ScrollView flex={1} backgroundColor={colors.background}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text fontSize="$sm" color={colors.textSecondary} marginTop="$4">
              載入中...
            </Text>
          </YStack>
        ) : error ? (
          <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
            <Ionicons name="alert-circle" size={48} color={colors.error} />
            <Text fontSize="$md" color={colors.textPrimary} marginTop="$4" textAlign="center">
              {error}
            </Text>
            <TouchableOpacity onPress={loadGuidelines} style={styles.retryButton}>
              <Text fontSize="$sm" color={colors.primary} fontWeight="600">
                重試
              </Text>
            </TouchableOpacity>
          </YStack>
        ) : guidelinesData ? (
          <YStack padding="$4" gap="$4">
            {/* Introduction */}
            <YStack
              backgroundColor="#fff"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor={colors.border}
            >
              <Text fontSize={18} fontWeight="600" color={colors.textPrimary} marginBottom="$2">
                {guidelinesData.title}
              </Text>
              <Text fontSize="$sm" color={colors.textPrimary} lineHeight={22}>
                {guidelinesData.introduction}
              </Text>
            </YStack>

            {/* Prohibited Content */}
            <YStack
              backgroundColor="#fff"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor={colors.border}
              gap="$3"
            >
              <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
                禁止內容類別
              </Text>

              {guidelinesData.prohibited_content.map((item, index) => (
                <YStack key={index} gap="$2">
                  <XStack alignItems="center" gap="$2">
                    <YStack
                      width={6}
                      height={6}
                      borderRadius={3}
                      backgroundColor={colors.primary}
                    />
                    <Text fontSize="$sm" fontWeight="600" color={colors.textPrimary}>
                      {item.category}
                    </Text>
                  </XStack>
                  <Text fontSize="$sm" color={colors.textSecondary} lineHeight={20} marginLeft="$4">
                    {item.description}
                  </Text>
                  {item.examples && item.examples.length > 0 && (
                    <YStack marginLeft="$4" gap="$1">
                      <Text fontSize="$xs" color={colors.textSecondary} fontStyle="italic">
                        範例：
                      </Text>
                      {item.examples.map((example, exIndex) => (
                        <Text
                          key={exIndex}
                          fontSize="$xs"
                          color={colors.textSecondary}
                          lineHeight={18}
                        >
                          • {example}
                        </Text>
                      ))}
                    </YStack>
                  )}
                </YStack>
              ))}
            </YStack>

            {/* Penalties */}
            <YStack
              backgroundColor="#fff"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor={colors.border}
              gap="$3"
            >
              <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
                違規處理
              </Text>

              {guidelinesData.penalties.map((penalty, index) => (
                <YStack
                  key={index}
                  padding="$3"
                  borderRadius="$3"
                  backgroundColor="#f8f9fa"
                  gap="$1"
                >
                  <Text fontSize="$sm" fontWeight="600" color={colors.textPrimary}>
                    {penalty.threshold}
                  </Text>
                  <Text fontSize="$sm" color={colors.textSecondary} lineHeight={20}>
                    {penalty.consequence}
                  </Text>
                </YStack>
              ))}
            </YStack>

            {/* Reporting Process */}
            <YStack
              backgroundColor="#fffbec"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor="#ffd54f"
              gap="$2"
            >
              <XStack alignItems="center" gap="$2">
                <Ionicons name="information-circle" size={20} color="#f57c00" />
                <Text fontSize="$md" fontWeight="600" color="#f57c00">
                  檢舉流程
                </Text>
              </XStack>
              <Text fontSize="$sm" color={colors.textPrimary} lineHeight={20}>
                {guidelinesData.reporting_process}
              </Text>
            </YStack>

            {/* Appeal Process */}
            {guidelinesData.appeal_process && (
              <YStack
                backgroundColor="#fff"
                padding="$4"
                borderRadius="$4"
                borderWidth={1}
                borderColor={colors.border}
                gap="$2"
              >
                <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
                  申訴程序
                </Text>
                <Text fontSize="$sm" color={colors.textSecondary} lineHeight={20}>
                  {guidelinesData.appeal_process}
                </Text>
              </YStack>
            )}

            {/* Footer Note */}
            <YStack
              backgroundColor="#f8f9fa"
              padding="$3"
              borderRadius="$3"
              borderWidth={1}
              borderColor={colors.border}
            >
              <Text fontSize="$sm" color={colors.textSecondary} textAlign="center" lineHeight={20}>
                請確保您的內容符合上述規範，以維護平台良好環境。
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
