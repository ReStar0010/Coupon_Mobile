/**
 * Help & Support Screen
 * UGC Compliance (Apple Guideline 1.2) - User Story 5
 *
 * Displays support contact information accessible within 2 taps.
 */

import React from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity, Linking, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';

export default function HelpSupportScreen() {
  const router = useRouter();

  const handleEmailPress = async () => {
    const email = 'coupro707@gmail.com';
    const url = `mailto:${email}`;
    
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('無法開啟', `請手動發送郵件至：${email}`);
    }
  };

  const handleWebsitePress = async () => {
    const url = 'https://coupro.app/support';
    
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('無法開啟', '請稍後再試');
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
        <Text fontSize="$lg" fontWeight="600" color="#fff" marginLeft="$2">
          幫助與支援
        </Text>
      </XStack>

      {/* Content */}
      <ScrollView flex={1} backgroundColor={colors.background}>
        <YStack padding="$4" gap="$4">
          {/* Introduction */}
          <YStack
            backgroundColor="#fff"
            padding="$4"
            borderRadius="$4"
            borderWidth={1}
            borderColor={colors.border}
          >
            <Text fontSize="$md" color={colors.textPrimary} lineHeight={24}>
              如果您有任何問題或需要協助，請透過以下方式聯絡我們。我們將盡快回覆您的詢問。
            </Text>
          </YStack>

          {/* Email Contact */}
          <TouchableOpacity onPress={handleEmailPress} activeOpacity={0.7}>
            <YStack
              backgroundColor="#fff"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor={colors.border}
            >
              <XStack alignItems="center" gap="$3">
                <YStack
                  width={48}
                  height={48}
                  borderRadius={24}
                  backgroundColor={colors.primary}
                  justifyContent="center"
                  alignItems="center"
                >
                  <Ionicons name="mail" size={24} color="#fff" />
                </YStack>
                <YStack flex={1}>
                  <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
                    電子郵件
                  </Text>
                  <Text fontSize="$sm" color={colors.textSecondary} marginTop="$1">
                    coupro707@gmail.com
                  </Text>
                </YStack>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </XStack>
            </YStack>
          </TouchableOpacity>

          {/* Website Support */}
          <TouchableOpacity onPress={handleWebsitePress} activeOpacity={0.7}>
            <YStack
              backgroundColor="#fff"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor={colors.border}
            >
              <XStack alignItems="center" gap="$3">
                <YStack
                  width={48}
                  height={48}
                  borderRadius={24}
                  backgroundColor={colors.primary}
                  justifyContent="center"
                  alignItems="center"
                >
                  <Ionicons name="globe" size={24} color="#fff" />
                </YStack>
                <YStack flex={1}>
                  <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
                    線上支援中心
                  </Text>
                  <Text fontSize="$sm" color={colors.textSecondary} marginTop="$1">
                    coupro.app/support
                  </Text>
                </YStack>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </XStack>
            </YStack>
          </TouchableOpacity>

          {/* Common Questions */}
          <YStack
            backgroundColor="#fff"
            padding="$4"
            borderRadius="$4"
            borderWidth={1}
            borderColor={colors.border}
            gap="$3"
          >
            <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
              常見問題
            </Text>

            <YStack gap="$2">
              <Text fontSize="$sm" fontWeight="600" color={colors.textPrimary}>
                如何使用優惠券？
              </Text>
              <Text fontSize="$sm" color={colors.textSecondary} lineHeight={20}>
                在首頁瀏覽優惠券，點擊「領取」按鈕後，前往商店出示兌換碼或 QR Code 即可使用。
              </Text>
            </YStack>

            <YStack gap="$2">
              <Text fontSize="$sm" fontWeight="600" color={colors.textPrimary}>
                如何舉報不當內容？
              </Text>
              <Text fontSize="$sm" color={colors.textSecondary} lineHeight={20}>
                在優惠券或商店頁面點擊「舉報」按鈕，選擇舉報原因並提交即可。
              </Text>
            </YStack>

            <YStack gap="$2">
              <Text fontSize="$sm" fontWeight="600" color={colors.textPrimary}>
                如何封鎖商家？
              </Text>
              <Text fontSize="$sm" color={colors.textSecondary} lineHeight={20}>
                在商店頁面點擊「封鎖商家」，確認後該商家的內容將不再顯示於您的動態中。
              </Text>
            </YStack>
          </YStack>

          {/* Support Hours */}
          <YStack
            backgroundColor="#f8f9fa"
            padding="$3"
            borderRadius="$3"
            borderWidth={1}
            borderColor={colors.border}
          >
            <Text fontSize="$sm" color={colors.textSecondary} textAlign="center" lineHeight={20}>
              客服回覆時間：週一至週五 09:00-18:00
            </Text>
            <Text fontSize="$sm" color={colors.textSecondary} textAlign="center" lineHeight={20}>
              （國定假日除外）
            </Text>
          </YStack>
        </YStack>
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
});

