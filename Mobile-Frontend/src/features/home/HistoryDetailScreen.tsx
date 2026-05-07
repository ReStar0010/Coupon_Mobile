import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { HISTORY_DATA } from './historyData';

interface HistoryDetailScreenProps {
  id: string;
  onBack: () => void;
}

export default function HistoryDetailScreen({
  id,
  onBack,
}: HistoryDetailScreenProps): React.JSX.Element {
  const entry = HISTORY_DATA.find((e) => e.id === id);

  if (!entry) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.title}>紀錄詳情</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>找不到此筆紀錄</Text>
        </View>
      </View>
    );
  }

  const isCoupoint = entry.type === 'coupoint';
  const [date, time] = entry.usedAt.split(' ');
  const accentColor = isCoupoint ? colors.purple : colors.yellow;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable testID="detail-back" onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>紀錄詳情</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        {/* Main card */}
        <View style={styles.cardWrapper}>
          <View style={[styles.cardShadow, { backgroundColor: colors.border }]} />
          <View style={[styles.card, { borderColor: colors.border }]}>
            <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />

            <View style={styles.cardBody}>
              {/* Type pill */}
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

              {/* Store name */}
              <Text style={styles.storeName}>{entry.store}</Text>
              <Text style={styles.detail}>{entry.detail}</Text>

              {/* Amount */}
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>折抵金額</Text>
                <View style={styles.amountValueRow}>
                  <Text style={styles.amountDollar}>$</Text>
                  <Text style={styles.amountNum}>{entry.amount}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Meta rows */}
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
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>狀態</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>已使用</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Used stamp */}
        <View style={styles.stampWrapper}>
          <View style={[styles.stamp, { borderColor: colors.muted }]}>
            <Text style={[styles.stampText, { color: colors.muted }]}>USED</Text>
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
  },
  notFoundText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: colors.muted,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  cardWrapper: {
    position: 'relative',
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
    alignItems: 'flex-end',
    marginTop: 24,
    paddingRight: 8,
  },
  stamp: {
    borderWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    transform: [{ rotate: '-12deg' }],
  },
  stampText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    letterSpacing: 4,
  },
});
