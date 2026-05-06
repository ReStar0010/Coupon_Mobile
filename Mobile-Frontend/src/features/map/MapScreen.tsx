import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { GemBadge, CouPointBadge } from '../../components/ui/Badges';
import TabBar from '../../components/chrome/TabBar';
import NeoBrutMap from './NeoBrutMap';
import NeoTeardropPin from './NeoTeardropPin';
import FlagStoreModal from './FlagStoreModal';
import BlockStoreModal from './BlockStoreModal';
import SharedCouponModal, { SharedCoupon } from './SharedCouponModal';
import { MapMerchant } from './types';

interface MapScreenProps {
  onNavigate: (screen: string, params?: object) => void;
  gems: number;
  couPoints: number;
}

const SAMPLE_MERCHANTS: MapMerchant[] = [
  { id: '1', name: '阿明早餐店', lat: 25.0478, lng: 121.5318, couponCount: 3, active: true, big: true },
  { id: '2', name: '鼎泰豐', lat: 25.049, lng: 121.534, couponCount: 5, active: true },
  { id: '3', name: '85度C', lat: 25.046, lng: 121.5302, couponCount: 1, active: true },
  { id: '4', name: '全聯', lat: 25.0452, lng: 121.5358, couponCount: 0, active: false },
  { id: '5', name: '7-Eleven', lat: 25.0485, lng: 121.5295, couponCount: 0, active: false },
  { id: '6', name: '全家', lat: 25.0468, lng: 121.5375, couponCount: 8, active: true, big: true },
  { id: '7', name: '統一超商', lat: 25.0499, lng: 121.533, couponCount: 0, active: false },
];

const DEMO_COUPON: SharedCoupon = {
  store: '阿明早餐店',
  amount: 25,
  sharer: '小明',
  msg: '推薦你去試試他們的蛋餅！',
  label: '$25 現金折抵',
};

export default function MapScreen({ onNavigate, gems, couPoints }: MapScreenProps): React.JSX.Element {
  const [showFlag, setShowFlag] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [sharedCoupon, setSharedCoupon] = useState<SharedCoupon | null>(null);
  const [selectedStore, setSelectedStore] = useState('阿明早餐店');

  useEffect(() => {
    const t = setTimeout(() => setSharedCoupon(DEMO_COUPON), 3000);
    return () => clearTimeout(t);
  }, []);

  const handlePinPress = (m: MapMerchant) => {
    if (!m.active) return;
    onNavigate('coupon-detail', { store: m.name, couponCount: m.couponCount });
  };

  const handleLongPress = (m: MapMerchant) => {
    if (!m.active) return;
    setSelectedStore(m.name);
    setShowFlag(true);
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapContainer}>
        <NeoBrutMap>
          {SAMPLE_MERCHANTS.map((m) => (
            <NeoTeardropPin
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              active={m.active}
              count={m.active ? m.couponCount : undefined}
              big={m.big}
              onPress={() => handlePinPress(m)}
            />
          ))}
        </NeoBrutMap>

        {/* Header */}
        <View style={styles.header} pointerEvents="box-none">
          <View style={styles.headerInner}>
            <Text style={styles.timeText}>9:41</Text>
            <View style={styles.badges}>
              <GemBadge count={gems} />
              <CouPointBadge count={couPoints} />
            </View>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <View style={styles.searchLogoBox}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={8} fill={colors.fg} />
              <Path d="M9 12h6M12 9v6" stroke={colors.yellow} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
          <TextInput
            placeholder="搜尋店家或優惠…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            editable={false}
          />
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={7} stroke={colors.muted} strokeWidth={2} />
            <Path d="M16 16 L21 21" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </View>

        {/* Location button */}
        <Pressable style={styles.locationBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={3} fill={colors.yellow} />
            <Circle cx={12} cy={12} r={7} stroke={colors.border} strokeWidth={1.8} />
            <Path d="M12 1.5V5 M12 19V22.5 M1.5 12H5 M19 12H22.5" stroke={colors.border} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        </Pressable>

        {/* Flag & Block buttons */}
        <View style={styles.actionBtns}>
          <Pressable onPress={() => setShowFlag(true)} style={styles.actionBtn}>
            <Text style={styles.actionBtnIcon}>⚑</Text>
          </Pressable>
          <Pressable onPress={() => setShowBlock(true)} style={styles.actionBtn}>
            <Text style={styles.actionBtnIcon}>🚫</Text>
          </Pressable>
        </View>
      </View>

      <TabBar activeTab="map" onTabPress={(t) => onNavigate(t as string)} />

      <FlagStoreModal
        visible={showFlag}
        store={selectedStore}
        onClose={() => setShowFlag(false)}
      />
      <BlockStoreModal
        visible={showBlock}
        store={selectedStore}
        onConfirm={() => setShowBlock(false)}
        onClose={() => setShowBlock(false)}
      />
      <SharedCouponModal
        visible={sharedCoupon !== null}
        coupon={sharedCoupon}
        onClaim={() => setSharedCoupon(null)}
        onClose={() => setSharedCoupon(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapContainer: { flex: 1, position: 'relative' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingTop: 8, paddingBottom: 8,
    backgroundColor: 'rgba(250,250,245,0.92)',
  },
  headerInner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
  },
  timeText: { fontFamily: fontFamilies.monoSemiBold, fontSize: 13, color: colors.fg },
  badges: { flexDirection: 'row', gap: 8 },
  searchBar: {
    position: 'absolute', top: 58, left: 16, right: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderWidth: 2.5, borderColor: colors.border, borderRadius: 6,
    shadowColor: colors.border, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  searchLogoBox: {
    width: 34, height: 34, backgroundColor: colors.yellow,
    borderWidth: 2, borderColor: colors.border, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.border, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fontFamilies.medium, color: colors.fg },
  locationBtn: {
    position: 'absolute', right: 16, bottom: 90, zIndex: 10,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF', borderWidth: 2.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.border, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  actionBtns: {
    position: 'absolute', left: 16, bottom: 90, zIndex: 10,
    flexDirection: 'column', gap: 8,
  },
  actionBtn: {
    width: 42, height: 42, backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.border, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.border, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0,
  },
  actionBtnIcon: { fontSize: 18 },
});
