import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import TicketIcon from '@/src/components/icons/TicketIcon';
import GemIcon from '@/src/components/icons/GemIcon';
import CouponRow from '@/src/components/ui/CouponRow';
import HomeHeader from './HomeHeader';
import CouPointsCard from './CouPointsCard';
import DrawModal from './DrawModal';

interface NavParams {
  store?: string;
  detail?: string;
  expires?: string;
  amount?: number;
}
interface ScreenProps {
  onNavigate: (screen: string, params?: NavParams) => void;
  gems: number;
  setGems: (fn: (prev: number) => number) => void;
  couPoints: number;
  setCouPoints: (fn: (prev: number) => number) => void;
}

const SAMPLE_COUPONS = [
  {
    id: '1',
    store: '阿明早餐店',
    detail: '$25 現金折抵',
    expires: '11/08',
    amount: 25,
    urgency: 'expiring' as const,
  },
  {
    id: '2',
    store: '手沖小巷',
    detail: '$10 現金折抵',
    expires: '11/30',
    amount: 10,
    urgency: 'new' as const,
  },
  {
    id: '3',
    store: '夜市攤三杯',
    detail: '$5 現金折抵',
    expires: '12/15',
    amount: 5,
    urgency: null,
  },
  {
    id: '4',
    store: '全聯福利中心',
    detail: '$15 現金折抵',
    expires: '12/01',
    amount: 15,
    urgency: null,
  },
];

export default function HomeScreen({
  onNavigate,
  gems,
  couPoints,
}: ScreenProps): React.JSX.Element {
  const [showDraw, setShowDraw] = useState(false);

  const header = (
    <>
      <HomeHeader onSettings={() => onNavigate('settings')} />
      <CouPointsCard
        couPoints={couPoints}
        onUse={() => onNavigate('coupoint-use')}
        onHistory={() => onNavigate('coupoint-history')}
      />
      <View style={s.gemBannerOuter}>
        <View style={s.gemBannerShadow} />
        <Pressable onPress={() => onNavigate('spinner')} style={s.gemBanner}>
          <View style={s.gemInfo}>
            <Text style={s.gemLabel}>CouGem 寶石</Text>
            <View style={s.gemCountRow}>
              <GemIcon size={38} color={colors.purpleLight} />
              <Text style={s.gemNum}>{gems}</Text>
              <Text style={s.gemUnit}>顆</Text>
            </View>
          </View>
          <View style={s.gemCtaBtn}>
            <Text style={s.gemCta}>抽獎 →</Text>
          </View>
        </Pressable>
      </View>
      <View style={s.sectionHeader}>
        <View style={s.sectionLeft}>
          <TicketIcon size={18} />
          <Text style={s.sectionTitle}>我的券</Text>
        </View>
        <View style={s.countOuter}>
          <View style={s.countShadow} />
          <View style={s.countBadge}>
            <Text style={s.countNum}>{SAMPLE_COUPONS.length}</Text>
            <Text style={s.countLabel}>張</Text>
          </View>
        </View>
      </View>
      <View style={s.drawOuter}>
        <View style={s.drawShadow} />
        <Pressable onPress={() => setShowDraw(true)} style={s.drawBtn}>
          <Text style={s.drawLabel}>DAILY DRAW</Text>
          <View style={s.drawMain}>
            <TicketIcon size={32} />
            <Text style={s.drawTitle}>每日抽券</Text>
          </View>
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={s.root}>
      <FlatList
        data={SAMPLE_COUPONS}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={s.rowWrap}>
            <CouponRow
              store={item.store}
              detail={item.detail}
              expires={item.expires}
              amount={item.amount}
              urgency={item.urgency ?? null}
              onPress={() =>
                onNavigate('coupon-detail', {
                  store: item.store,
                  detail: item.detail,
                  expires: item.expires,
                  amount: item.amount,
                })
              }
              onShare={() =>
                onNavigate('coupon-share', {
                  store: item.store,
                  detail: item.detail,
                  expires: item.expires,
                  amount: item.amount,
                })
              }
            />
          </View>
        )}
      />
      <DrawModal visible={showDraw} onClose={() => setShowDraw(false)} onDraw={() => {}} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: 88 },
  rowWrap: { paddingHorizontal: 16, marginBottom: 8 },
  gemInfo: { flex: 1 },
  gemBannerOuter: { position: 'relative', marginHorizontal: 16, marginBottom: 20 },
  gemBannerShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  gemBanner: {
    backgroundColor: colors.purple,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gemLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 2,
  },
  gemCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  gemNum: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.44,
    color: '#fff',
  },
  gemUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  gemCtaBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gemCta: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: colors.fg,
    letterSpacing: -0.15,
  },
  countOuter: { position: 'relative' },
  countShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: -2,
    bottom: -2,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countNum: { fontFamily: fontFamilies.extraBold, fontSize: 17, color: colors.fg },
  countLabel: { fontFamily: fontFamilies.regular, fontSize: 11, color: colors.muted },
  drawOuter: { position: 'relative', marginHorizontal: 16, marginBottom: 20 },
  drawShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  drawBtn: {
    backgroundColor: colors.yellowLight,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  drawLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(51,51,51,0.55)',
    marginBottom: 8,
  },
  drawMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 26,
    letterSpacing: -0.52,
    color: colors.fg,
  },
});
