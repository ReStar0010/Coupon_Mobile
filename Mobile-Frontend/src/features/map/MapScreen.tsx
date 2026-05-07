import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../theme/colors';
import LogoIcon from '../../components/icons/LogoIcon';
import { fontFamilies } from '../../theme/typography';
import NeoBrutMap from './NeoBrutMap';
import NeoTeardropPin from './NeoTeardropPin';
import FlagStoreModal from './FlagStoreModal';
import BlockStoreModal from './BlockStoreModal';
import SharedCouponModal, { SharedCoupon } from './SharedCouponModal';
import { MapMerchant } from './types';

interface MapScreenProps {
  onNavigate: (screen: string, params?: object) => void;
}

const DEMO_COUPON: SharedCoupon = {
  store: '阿明早餐店',
  amount: 25,
  sharer: '小明',
  msg: '推薦你去試試他們的蛋餅！',
  label: '$25 現金折抵',
};

const SAMPLE_MERCHANTS: MapMerchant[] = [
  {
    id: '1',
    name: '阿明早餐店',
    lat: 25.0478,
    lng: 121.5318,
    couponCount: 3,
    active: true,
    big: true,
  },
  { id: '2', name: '鼎泰豐', lat: 25.049, lng: 121.534, couponCount: 5, active: true },
  { id: '3', name: '85度C', lat: 25.046, lng: 121.5302, couponCount: 1, active: true },
  { id: '4', name: '全聯', lat: 25.0452, lng: 121.5358, couponCount: 0, active: false },
  { id: '5', name: '7-Eleven', lat: 25.0485, lng: 121.5295, couponCount: 0, active: false },
  { id: '6', name: '全家', lat: 25.0468, lng: 121.5375, couponCount: 8, active: true, big: true },
  { id: '7', name: '統一超商', lat: 25.0499, lng: 121.533, couponCount: 0, active: false },
];

export default function MapScreen({ onNavigate }: MapScreenProps): React.JSX.Element {
  const [showFlag, setShowFlag] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [sharedCoupon, setSharedCoupon] = useState<SharedCoupon | null>(null);
  const [selectedStore, setSelectedStore] = useState('阿明早餐店');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSharedCoupon(DEMO_COUPON), 3000);
    return () => clearTimeout(t);
  }, []);

  const filteredMerchants =
    searchText.trim().length > 0
      ? SAMPLE_MERCHANTS.filter((m) => m.name.includes(searchText.trim()))
      : [];

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

        {/* Search bar */}
        <View style={styles.searchBar}>
          <View style={styles.searchLogoBox}>
            <LogoIcon size={22} />
          </View>
          <TextInput
            placeholder="搜尋店家或優惠…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
          />
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={7} stroke={colors.muted} strokeWidth={2} />
            <Path d="M16 16 L21 21" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </View>

        {/* Search results dropdown */}
        {filteredMerchants.length > 0 && (
          <View style={styles.dropdown}>
            {filteredMerchants.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  setSearchText(m.name);
                  handlePinPress(m);
                }}
                style={styles.dropdownItem}
              >
                <Text style={styles.dropdownName}>{m.name}</Text>
                {m.active ? (
                  <View style={styles.dropdownBadge}>
                    <Text style={styles.dropdownBadgeText}>{m.couponCount} 張券</Text>
                  </View>
                ) : (
                  <Text style={styles.dropdownInactive}>暫無券</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Location button */}
        <Pressable style={styles.locationBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={3} fill={colors.yellow} />
            <Circle cx={12} cy={12} r={7} stroke={colors.border} strokeWidth={1.8} />
            <Path
              d="M12 1.5V5 M12 19V22.5 M1.5 12H5 M19 12H22.5"
              stroke={colors.border}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
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

      <FlagStoreModal visible={showFlag} store={selectedStore} onClose={() => setShowFlag(false)} />
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
  searchBar: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    shadowColor: colors.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  searchLogoBox: {
    width: 34,
    height: 34,
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.border,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fontFamilies.medium, color: colors.fg },
  locationBtn: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    zIndex: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.border,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  actionBtns: {
    position: 'absolute',
    left: 16,
    bottom: 90,
    zIndex: 10,
    flexDirection: 'column',
    gap: 8,
  },
  actionBtn: {
    width: 42,
    height: 42,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.border,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  actionBtnIcon: { fontSize: 18 },
  dropdown: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    zIndex: 20,
    backgroundColor: '#fff',
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    shadowColor: colors.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51,51,51,0.1)',
  },
  dropdownName: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.fg,
  },
  dropdownBadge: {
    backgroundColor: colors.yellowLight,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dropdownBadgeText: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    color: colors.fg,
  },
  dropdownInactive: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    color: colors.muted,
  },
});
