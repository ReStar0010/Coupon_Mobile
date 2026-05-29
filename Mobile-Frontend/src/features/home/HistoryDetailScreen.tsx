import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import {
  HistoryEntryDetail,
  getTransaction,
} from '@/src/services/api/transactions';

interface HistoryDetailScreenProps {
  id: string;
  onBack: () => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'success'; entry: HistoryEntryDetail }
  | { status: 'error'; message: string };

export default function HistoryDetailScreen({
  id,
  onBack,
}: HistoryDetailScreenProps): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Detail route lives outside (tabs); no parent inset.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const entry = await getTransaction(id);
        if (!cancelled) {
          setState({ status: 'success', entry });
        }
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : '載入失敗';
        setState({ status: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="detail-back" onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>紀錄詳情</Text>
        <View style={styles.backBtn} />
      </View>

      {state.status === 'loading' ? (
        <View style={styles.notFound} testID="detail-loading">
          <ActivityIndicator color={colors.fg} />
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.notFound} testID="detail-error">
          <Text style={styles.notFoundText}>{state.message || '找不到此筆紀錄'}</Text>
        </View>
      ) : (
        <DetailBody entry={state.entry} />
      )}
    </View>
  );
}

function DetailBody({ entry }: { entry: HistoryEntryDetail }): React.JSX.Element {
  const isCoupoint = entry.type === 'coupoint';
  const [date, time] = entry.usedAt.split(' ');
  const accentColor = isCoupoint ? colors.purple : colors.yellow;
  const storeLabel = entry.store ?? entry.coupon?.name ?? '—';

  return (
    <View style={styles.content}>
      <View style={styles.cardWrapper}>
        <View style={[styles.cardShadow, { backgroundColor: colors.border }]} />
        <View style={[styles.card, { borderColor: colors.border }]}>
          <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />

          <View style={styles.cardBody} testID="history-card-body">
            <View
              style={[
                styles.typePill,
                { backgroundColor: accentColor, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.typeText, { color: isCoupoint ? '#fff' : colors.fg }]}>
                {isCoupoint ? 'CouPoint 兌換' : '優惠券使用'}
              </Text>
            </View>

            <Text style={styles.storeName}>{storeLabel}</Text>
            <Text style={styles.detail}>{entry.detail}</Text>

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>折抵金額</Text>
              <View style={styles.amountValueRow}>
                <Text style={styles.amountDollar}>$</Text>
                <Text style={styles.amountNum}>{entry.amount}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>使用日期</Text>
              <Text style={styles.metaVal}>{date}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>使用時間</Text>
              <Text style={styles.metaVal}>{time}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>紀錄編號</Text>
              <Text style={styles.metaVal}># {entry.id.padStart(6, '0')}</Text>
            </View>
            {entry.coupon ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>優惠券</Text>
                <Text style={styles.metaVal} testID="detail-coupon">
                  {entry.coupon.name}
                </Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>狀態</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>已使用</Text>
              </View>
            </View>
          </View>
        </View>

        <View pointerEvents="none" style={styles.stampWrapper}>
          <View style={styles.stamp} testID="used-stamp">
            <Text style={styles.stampText}>USED</Text>
          </View>
        </View>
      </View>
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
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  notFoundText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  cardWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  cardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    borderRadius: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 2.5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  accentStrip: {
    height: 8,
  },
  cardBody: {
    padding: 20,
  },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  typeText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  storeName: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 26,
    color: colors.fg,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  detail: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 20,
  },
  amountRow: {
    marginBottom: 20,
  },
  amountLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 4,
  },
  amountValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  amountDollar: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: colors.fg,
  },
  amountNum: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 52,
    letterSpacing: -2,
    lineHeight: 54,
    color: colors.fg,
  },
  divider: {
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaKey: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.muted,
  },
  metaVal: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 13,
    color: colors.fg,
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 11,
    color: colors.muted,
  },
  stampWrapper: {
    position: 'absolute',
    top: 70,
    right: -8,
    zIndex: 10,
    elevation: 10,
    transform: [{ rotate: '-14deg' }],
  },
  stamp: {
    borderWidth: 3.5,
    borderColor: colors.red,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stampText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 26,
    letterSpacing: 5,
    color: colors.red,
  },
});
