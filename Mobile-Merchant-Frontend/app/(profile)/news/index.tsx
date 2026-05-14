import React, { useState, useCallback } from 'react';
import * as Sentry from '@sentry/react-native';
import { YStack, XStack, Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors } from '@/constants/colors';
import { Header } from '../../(coupons)/components/Header';
import { Button } from '@/components/ui';
import { listNews, deleteNews, type StoreNewsItem } from '@/services/newsAPI';
import { AuthenticationError } from '@/utils/api';
import { useApiError } from '@/hooks/useApiError';

function computeAgoText(isoDate: string): string {
  const created = new Date(isoDate).getTime();
  if (Number.isNaN(created)) return '';
  const diffMs = Date.now() - created;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return '剛剛';
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小時前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} 天前`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 4) return `${diffWk} 週前`;
  return new Date(isoDate).toLocaleDateString('zh-TW');
}

interface NewsRowProps {
  item: StoreNewsItem;
  onDelete: (id: number) => void;
}

function NewsRow({ item, onDelete }: NewsRowProps): React.ReactElement {
  return (
    <View style={styles.row} testID={`news-row-${item.id}`}>
      <YStack flex={1} gap="$1">
        <Text fontSize="$md" color={colors.textPrimary}>
          {item.body}
        </Text>
        <Text fontSize="$xs" color={colors.textSecondary}>
          {computeAgoText(item.created_at)}
        </Text>
      </YStack>
      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.deleteButton}
        accessibilityLabel="刪除這則近況"
      >
        <MaterialIcons name="delete-outline" size={22} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

export default function StoreNewsListScreen(): React.ReactElement {
  const router = useRouter();
  const { getErrorMessage } = useApiError();
  const [items, setItems] = useState<StoreNewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadList = useCallback(async (): Promise<void> => {
    try {
      setLoadError(null);
      const data = await listNews();
      setItems(data);
    } catch (error: unknown) {
      console.error('Failed to load store news:', error);
      if (error instanceof AuthenticationError) {
        router.replace('/(auth)/login');
        return;
      }
      Sentry.captureException(error, { data: { context: 'merchant.news.list' } });
      setLoadError(getErrorMessage(error));
    }
  }, [router, getErrorMessage]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setIsLoading(true);
        await loadList();
        if (active) setIsLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [loadList]),
  );

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    await loadList();
    setIsRefreshing(false);
  }, [loadList]);

  const handleDelete = useCallback(
    (id: number): void => {
      Alert.alert('刪除近況', '確定要刪除這則店家近況嗎？', [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNews(id);
              setItems((prev) => prev.filter((n) => n.id !== id));
            } catch (error: unknown) {
              console.error('Failed to delete store news:', error);
              Sentry.captureException(error, { data: { context: 'merchant.news.delete' } });
              Alert.alert('錯誤', getErrorMessage(error));
            }
          },
        },
      ]);
    },
    [getErrorMessage],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top', 'bottom']}>
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
            店家近況管理
          </Text>
          <Button variant="primary" onPress={() => router.push('/(profile)/news/edit')}>
            新增
          </Button>
        </XStack>

        {isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.centerFill}>
            <Text color={colors.error} marginBottom="$3">
              {loadError}
            </Text>
            <Button variant="primary" onPress={handleRefresh}>
              重試
            </Button>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerFill}>
            <Text color={colors.textSecondary} marginBottom="$3">
              尚未發布店家近況
            </Text>
            <Button variant="primary" onPress={() => router.push('/(profile)/news/edit')}>
              新增
            </Button>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => String(it.id)}
            renderItem={({ item }) => <NewsRow item={item} onDelete={handleDelete} />}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginBottom: 12,
    gap: 12,
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
