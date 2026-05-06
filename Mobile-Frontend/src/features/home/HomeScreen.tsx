import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import LogoIcon from '@/src/components/icons/LogoIcon';
import SettingsIcon from '@/src/components/icons/SettingsIcon';
import TicketIcon from '@/src/components/icons/TicketIcon';
import GemIcon from '@/src/components/icons/GemIcon';
import CouponRow from '@/src/components/ui/CouponRow';
import TabBar from '@/src/components/chrome/TabBar';
import AppStatusBar from '@/src/components/chrome/StatusBar';
import RedeemModal from './RedeemModal';
import DrawModal from './DrawModal';
import HomeHeader from './HomeHeader';
import CouPointsCard from './CouPointsCard';

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
  { id: '1', store: '阿明早餐店', detail: '$25 現金折抵', expires: '11/08', amount: 25, urgency: 'expiring' as const },
  { id: '2', store: '手沖小巷',   detail: '$10 現金折抵', expires: '11/30', amount: 10, urgency: 'new' as const },
  { id: '3', store: '夜市攤三杯', detail: '$5 現金折抵',  expires: '12/15', amount: 5,  urgency: null },
  { id: '4', store: '全聯福利中心', detail: '$15 現金折抵', expires: '12/01', amount: 15, urgency: null },
];

export default function HomeScreen({
  onNavigate,
  gems,
  couPoints,
  setCouPoints,
}: ScreenProps): React.JSX.Element {
  const [showRedeem, setShowRedeem] = useState(false);
  const [showDraw,   setShowDraw]   = useState(false);

  return (
    <SafeAreaView style={styles.root}>
      <AppStatusBar />
      <FlatList
        data={SAMPLE_COUPONS}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <HomeHeader
              gems={gems}
              couPoints={couPoints}
              onSettings={() => onNavigate('settings')}
            />
            <CouPointsCard
              couPoints={couPoints}
              onRedeem={() => setShowRedeem(true)}
            />
            <View style={styles.gemBannerWrapper}>
              <View style={styles.gemBannerShadow} />
              <Pressable
                onPress={() => onNavigate('spinner')}
                style={styles.gemBanner}
              >
                <View style={styles.gemBannerLeft}>
                  <GemIcon size={30} color={colors.purpleLight} />
                  <View>
                    <Text style={styles.gemBannerTitle}>
                      <Text style={styles.gemCount}>{gems}</Text> 顆寶石 · 可抽獎
                    </Text>
                    <Text style={styles.gemBannerSub}>前往抽獎桌</Text>
                  </View>
                </View>
                <Text style={styles.gemBannerArrow}>→</Text>
              </Pressable>
            </View>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitle}>
                <TicketIcon size={18} />
                <Text style={styles.sectionTitleText}>我的券</Text>
              </View>
              <View style={styles.countBadgeWrapper}>
                <View style={styles.countBadgeShadow} />
                <View style={styles.countBadge}>
                  <Text style={styles.countNum}>{SAMPLE_COUPONS.length}</Text>
                  <Text style={styles.countLabel}>張</Text>
                </View>
              </View>
            </View>
            <View style={styles.drawBtnWrapper}>
              <View style={styles.drawBtnShadow} />
              <Pressable onPress={() => setShowDraw(true)} style={styles.drawBtn}>
                <View style={styles.drawBtnLeft}>
                  <TicketIcon size={20} />
                  <Text style={styles.drawBtnText}>可兌換新券</Text>
                </View>
                <Text style={styles.drawBtnCta}>抽券去 →</Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <CouponRow
            store={item.store}
            detail={item.detail}
            expires={item.expires}
            amount={item.amount}
            urgency={item.urgency ?? null}
            onPress={() => onNavigate('coupon-detail', {
              store: item.store, detail: item.detail, expires: item.expires, amount: item.amount,
            })}
            onShare={() => onNavigate('coupon-share', {
              store: item.store, detail: item.detail, expires: item.expires, amount: item.amount,
            })}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      <TabBar
        activeTab="home"
        onTabPress={(tab) => onNavigate(tab)}
      />
      <RedeemModal
        visible={showRedeem}
        couPoints={couPoints}
        onClose={() => setShowRedeem(false)}
        onRedeem={() => {}}
      />
      <DrawModal
        visible={showDraw}
        onClose={() => setShowDraw(false)}
        onDraw={() => {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    padding: 0,
    paddingBottom: 8,
  },
  gemBannerWrapper: {
    position: 'relative',
    marginHorizontal: 16,
    marginBottom: 12,
  },
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
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gemBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gemBannerTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: -0.16,
  },
  gemCount: {
    fontFamily: fontFamilies.monoSemiBold,
  },
  gemBannerSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  gemBannerArrow: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 24,
    color: colors.purpleLight,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: colors.fg,
    letterSpacing: -0.15,
  },
  countBadgeWrapper: {
    position: 'relative',
  },
  countBadgeShadow: {
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
  countNum: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    color: colors.fg,
  },
  countLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.muted,
  },
  drawBtnWrapper: {
    position: 'relative',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  drawBtnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  drawBtn: {
    backgroundColor: colors.yellowLight,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: colors.fg,
  },
  drawBtnCta: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    color: colors.fg,
  },
});
