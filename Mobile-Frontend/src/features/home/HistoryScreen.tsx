import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import {
  HistoryEntry,
  HistoryType,
  listTransactions,
} from '@/src/services/api/transactions';

interface HistoryScreenProps {
  onBack: () => void;
  onSelect: (id: string) => void;
}

const FILTERS: ReadonlyArray<{ key: HistoryType; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'coupon', label: '優惠券' },
  { key: 'coupoint', label: 'CouPoint' },
];

const PAGE_SIZE = 25;

function HistoryItem({
  item,
  onSelect,
}: {
  item: HistoryEntry;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const isCoupoint = item.type === 'coupoint';
  const storeLabel = item.store ?? '—';
  return (
    <View style={styles.itemWrapper}>
      <View style={styles.itemShadow} />
      <Pressable
        testID={`history-item-${item.id}`}
        onPress={() => onSelect(item.id)}
        style={({ pressed }) => [styles.itemCard, pressed && styles.itemCardPressed]}
      >
        <View
          style={[styles.typePill, isCoupoint ? styles.typePillPoint : styles.typePillCoupon]}
        >
          <Text
            style={[styles.typeText, isCoupoint ? styles.typeTextPoint : styles.typeTextCoupon]}
          >
            {isCoupoint ? 'CouPoint' : '優惠券'}
          </Text>
        </View>
        <View style={styles.itemMain}>
          <Text style={styles.storeName}>{storeLabel}</Text>
          <Text style={styles.itemDetail}>{item.detail}</Text>
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemAmount}>-${item.amount}</Text>
          <Text style={styles.itemDate}>{item.usedAt.split(' ')[0]}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

export default function HistoryScreen({
  onBack,
  onSelect,
}: HistoryScreenProps): React.JSX.Element {
  const [filter, setFilter] = useState<HistoryType>('all');
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard against late responses overwriting a newer filter selection.
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(
    async (nextFilter: HistoryType, mode: 'initial' | 'refresh' | 'append') => {
      const requestId = ++requestIdRef.current;
      if (mode === 'initial') {
        setLoading(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const cursorForRequest = mode === 'append' ? cursor ?? undefined : undefined;
        const page = await listTransactions(nextFilter, PAGE_SIZE, cursorForRequest);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setError(null);
        setItems((prev) => (mode === 'append' ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (e) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        const message = e instanceof Error ? e.message : '載入失敗';
        setError(message);
        if (mode !== 'append') {
          setItems([]);
          setCursor(null);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [cursor],
  );

  useEffect(() => {
    void fetchPage(filter, 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleRefresh = useCallback(() => {
    void fetchPage(filter, 'refresh');
  }, [fetchPage, filter]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || refreshing || loading) return;
    if (cursor === null) return;
    void fetchPage(filter, 'append');
  }, [cursor, fetchPage, filter, loading, loadingMore, refreshing]);

  const totalSaved = useMemo(
    () => items.reduce((sum, e) => sum + e.amount, 0),
    [items],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable testID="history-back" onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>歷史紀錄</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.summaryWrapper}>
        <View style={styles.summaryShadow} />
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>總共省下</Text>
          <View style={styles.summaryAmtRow}>
            <Text style={styles.summaryDollar}>$</Text>
            <Text style={styles.summaryAmt}>{totalSaved}</Text>
          </View>
          <Text style={styles.summaryCount}>共 {items.length} 筆兌換紀錄</Text>
        </View>
      </View>

      <View style={styles.filterRow} testID="history-filters">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              testID={`history-filter-${f.key}`}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>兌換明細</Text>

      {loading ? (
        <View style={styles.centerState} testID="history-loading">
          <ActivityIndicator color={colors.fg} />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centerState} testID="history-error">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerState} testID="history-empty">
          <Text style={styles.emptyText}>尚無紀錄</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryItem item={item} onSelect={onSelect} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.fg}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={handleLoadMore}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading} testID="history-loading-more">
                <ActivityIndicator color={colors.fg} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: colors.fg,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    color: colors.fg,
    letterSpacing: -0.4,
  },
  summaryWrapper: {
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  summaryShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  summaryCard: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  summaryLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(51,51,51,0.55)',
    marginBottom: 4,
  },
  summaryAmtRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  summaryDollar: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 24,
    color: colors.fg,
  },
  summaryAmt: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 52,
    letterSpacing: -2,
    lineHeight: 54,
    color: colors.fg,
  },
  summaryCount: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: 'rgba(51,51,51,0.6)',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.card,
  },
  filterChipActive: {
    backgroundColor: colors.yellow,
  },
  filterText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 11,
    color: colors.muted,
  },
  filterTextActive: {
    color: colors.fg,
  },
  sectionLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  itemWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  itemShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  itemCardPressed: {
    backgroundColor: '#2A2A2A',
  },
  typePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  typePillCoupon: {
    backgroundColor: colors.yellow,
    borderColor: colors.border,
  },
  typePillPoint: {
    backgroundColor: colors.purple,
    borderColor: colors.border,
  },
  typeText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  typeTextCoupon: { color: colors.fg },
  typeTextPoint: { color: '#fff' },
  itemMain: {
    flex: 1,
  },
  storeName: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: colors.fg,
    marginBottom: 2,
  },
  itemDetail: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.muted,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    color: colors.fg,
    letterSpacing: -0.3,
  },
  itemDate: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  chevron: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    color: colors.muted,
    marginLeft: 2,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: colors.muted,
  },
  errorText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: colors.red,
    textAlign: 'center',
  },
  footerLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
