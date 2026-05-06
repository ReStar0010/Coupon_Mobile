import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import TicketIcon from '@/src/components/icons/TicketIcon';
import GemIcon from '@/src/components/icons/GemIcon';
import CouponRow from '@/src/components/ui/CouponRow';
import TabBar from '@/src/components/chrome/TabBar';
import AppStatusBar from '@/src/components/chrome/StatusBar';
import HomeHeader from './HomeHeader';
import CouPointsCard from './CouPointsCard';
import RedeemModal from './RedeemModal';
import DrawModal from './DrawModal';

interface NavParams { store?: string; detail?: string; expires?: string; amount?: number; }
interface ScreenProps {
  onNavigate: (screen: string, params?: NavParams) => void;
  gems: number;
  setGems: (fn: (prev: number) => number) => void;
  couPoints: number;
  setCouPoints: (fn: (prev: number) => number) => void;
}

const SAMPLE_COUPONS = [
  { id: '1', store: '阿明早餐店', detail: '$25 現金折抵', expires: '11/08', amount: 25, urgency: 'expiring' as const },
  { id: '2', store: '手沖小巷',   detail: '$10 現金折抵', expires: '11/30', amount: 10, urgency: 'new' as const },
  { id: '3', store: '夜市攤三杯', detail: '$5 現金折抵',  expires: '12/15', amount: 5,  urgency: null },
  { id: '4', store: '全聯福利中心', detail: '$15 現金折抵', expires: '12/01', amount: 15, urgency: null },
];

export default function HomeScreen({ onNavigate, gems, couPoints }: ScreenProps): React.JSX.Element {
  const [showRedeem, setShowRedeem] = useState(false);
  const [showDraw,   setShowDraw]   = useState(false);

  const header = (
    <>
      <HomeHeader gems={gems} couPoints={couPoints} onSettings={() => onNavigate('settings')} />
      <CouPointsCard couPoints={couPoints} onRedeem={() => setShowRedeem(true)} />
      <View style={s.gemBannerOuter}>
        <View style={s.gemBannerShadow} />
        <Pressable onPress={() => onNavigate('spinner')} style={s.gemBanner}>
          <View style={s.gemBannerLeft}>
            <GemIcon size={30} color={colors.purpleLight} />
            <View>
              <Text style={s.gemBannerTitle}><Text style={s.mono}>{gems}</Text> 顆寶石 · 可抽獎</Text>
              <Text style={s.gemBannerSub}>前往抽獎桌</Text>
            </View>
          </View>
          <Text style={s.gemArrow}>→</Text>
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
          <View style={s.drawLeft}><TicketIcon size={20} /><Text style={s.drawText}>可兌換新券</Text></View>
          <Text style={s.drawCta}>抽券去 →</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <SafeAreaView style={s.root}>
      <AppStatusBar />
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
              onPress={() => onNavigate('coupon-detail', { store: item.store, detail: item.detail, expires: item.expires, amount: item.amount })}
              onShare={() => onNavigate('coupon-share', { store: item.store, detail: item.detail, expires: item.expires, amount: item.amount })}
            />
          </View>
        )}
      />
      <TabBar activeTab="home" onTabPress={(tab) => onNavigate(tab)} />
      <RedeemModal visible={showRedeem} couPoints={couPoints} onClose={() => setShowRedeem(false)} onRedeem={() => {}} />
      <DrawModal visible={showDraw} onClose={() => setShowDraw(false)} onDraw={() => {}} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: 8 },
  rowWrap: { paddingHorizontal: 16 },
  gemBannerOuter: { position: 'relative', marginHorizontal: 16, marginBottom: 12 },
  gemBannerShadow: { position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, borderRadius: 8, backgroundColor: colors.border },
  gemBanner: { backgroundColor: colors.purple, borderWidth: 2.5, borderColor: colors.border, borderRadius: 8, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gemBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gemBannerTitle: { fontFamily: fontFamilies.extraBold, fontSize: 16, color: '#fff', letterSpacing: -0.16 },
  mono: { fontFamily: fontFamilies.monoSemiBold },
  gemBannerSub: { fontFamily: fontFamilies.regular, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  gemArrow: { fontFamily: fontFamilies.monoSemiBold, fontSize: 24, color: colors.purpleLight },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 10 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: fontFamilies.bold, fontSize: 15, color: colors.fg, letterSpacing: -0.15 },
  countOuter: { position: 'relative' },
  countShadow: { position: 'absolute', top: 2, left: 2, right: -2, bottom: -2, borderRadius: 4, backgroundColor: colors.border },
  countBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 3, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
  countNum: { fontFamily: fontFamilies.extraBold, fontSize: 17, color: colors.fg },
  countLabel: { fontFamily: fontFamilies.regular, fontSize: 11, color: colors.muted },
  drawOuter: { position: 'relative', marginHorizontal: 16, marginBottom: 12 },
  drawShadow: { position: 'absolute', top: 3, left: 3, right: -3, bottom: -3, borderRadius: 6, backgroundColor: colors.border },
  drawBtn: { backgroundColor: colors.yellowLight, borderWidth: 2.5, borderColor: colors.border, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  drawLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drawText: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg },
  drawCta: { fontFamily: fontFamilies.extraBold, fontSize: 14, color: colors.fg },
});
