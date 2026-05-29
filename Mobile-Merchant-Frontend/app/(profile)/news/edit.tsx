import React, { useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { YStack, XStack, Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StyleSheet, View, TouchableOpacity, TextInput, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors } from '@/constants/colors';
import { Header } from '../../(coupons)/components/Header';
import { Button } from '@/components/ui';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { createNews, STORE_NEWS_MAX_LENGTH } from '@/services/newsAPI';
import { AuthenticationError, type ApiError } from '@/utils/api';
import { useApiError } from '@/hooks/useApiError';

function getStatusCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const code = (error as ApiError).statusCode;
    return typeof code === 'number' ? code : undefined;
  }
  return undefined;
}

export default function StoreNewsEditScreen(): React.ReactElement {
  const router = useRouter();
  const { getErrorMessage } = useApiError();
  const [body, setBody] = useState<string>('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const trimmed = body.trim();
  const remaining = STORE_NEWS_MAX_LENGTH - body.length;
  const canSave = trimmed.length > 0 && body.length <= STORE_NEWS_MAX_LENGTH && !isSaving;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setInlineError(null);
    setIsSaving(true);
    try {
      await createNews(trimmed);
      router.back();
    } catch (error: unknown) {
      console.error('Failed to create store news:', error);
      if (error instanceof AuthenticationError) {
        router.replace('/(auth)/login');
        return;
      }
      const status = getStatusCode(error);
      if (status === 400 || status === 429) {
        setInlineError(getErrorMessage(error));
      } else {
        Sentry.captureException(error, { data: { context: 'merchant.news.create' } });
        Alert.alert('錯誤', getErrorMessage(error));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top', 'bottom']}>
      <DismissKeyboardView>
        <YStack flex={1} backgroundColor={colors.white}>
          <Header onLogoPress={() => router.push('/(coupons)/')} showMenu={false} />

          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            alignItems="center"
            justifyContent="space-between"
          >
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <MaterialIcons name="chevron-left" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text fontSize={20} fontWeight="700" color={colors.textPrimary}>
              新增店家近況
            </Text>
            <View style={{ width: 28 }} />
          </XStack>

          <YStack paddingHorizontal="$4" gap="$3" flex={1}>
            <TextInput
              style={styles.input}
              value={body}
              onChangeText={(text) => {
                // Hard cap input at 200 chars (backend rejects above this).
                setBody(text.slice(0, STORE_NEWS_MAX_LENGTH));
                if (inlineError) setInlineError(null);
              }}
              placeholder="分享店家最新近況，最多 200 字"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={STORE_NEWS_MAX_LENGTH}
              testID="news-body-input"
            />
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$xs" color={inlineError ? colors.error : colors.textSecondary}>
                {inlineError ?? `${body.length} / ${STORE_NEWS_MAX_LENGTH}`}
              </Text>
              {remaining < 0 ? (
                <Text fontSize="$xs" color={colors.error}>
                  超過 {Math.abs(remaining)} 字
                </Text>
              ) : null}
            </XStack>
          </YStack>

          <View style={styles.footer}>
            <Button
              variant="primary"
              fullWidth
              onPress={handleSave}
              disabled={!canSave}
              opacity={canSave ? 1 : 0.6}
            >
              {isSaving ? '送出中...' : '送出'}
            </Button>
          </View>
        </YStack>
      </DismissKeyboardView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
});
