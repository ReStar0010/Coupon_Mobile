import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../theme/colors';
import LogoIcon from '../../components/icons/LogoIcon';
import { fontFamilies } from '../../theme/typography';
import NeoBrutMap from './NeoBrutMap';
import NeoTeardropPin from './NeoTeardropPin';
import FlagStoreModal from './FlagStoreModal';
import BlockStoreModal from './BlockStoreModal';
import SharedCouponModal, { SharedCoupon } from './SharedCouponModal';
import MerchantSheet from './MerchantSheet';
import type { MapMerchant } from './types';
import {
  listNearby,
  getMerchant,
  flagMerchant,
  blockMerchant,
  type Merchant,
  type MerchantDetail,
  type MerchantCoupon,
  type SharedCouponSummary,
} from '@/src/services/api/merchants';

interface MapScreenProps {
  onNavigate: (screen: string, params?: object) => void;
}

// Fallback centre point if device geolocation is unavailable (Taipei).
const FALLBACK_LAT = 25.0478;
const FALLBACK_LNG = 121.5318;
const NEARBY_RADIUS_KM = 2;

/** Convert an API `Merchant` to the marker-level shape used by the map. */
function toMapMerchant(m: Merchant): MapMerchant {
  return {
    id: m.id,
    name: m.name,
    lat: m.lat,
    lng: m.lng,
    couponCount: 0,
    active: true,
  };
}

export default function MapScreen({ onNavigate }: MapScreenProps): React.JSX.Element {
  const [merchants, setMerchants] = useState<MapMerchant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeDetail, setActiveDetail] = useState<MerchantDetail | null>(null);
  const [showFlag, setShowFlag] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [sharedCoupon, setSharedCoupon] = useState<SharedCoupon | null>(null);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listNearby(FALLBACK_LAT, FALLBACK_LNG, NEARBY_RADIUS_KM);
        if (!cancelled) {
          setMerchants(result.map(toMapMerchant));
        }
      } catch (err) {
        if (!cancelled) {
          // Surface the failure to telemetry instead of crashing the screen.
          // eslint-disable-next-line no-console
          console.warn('listNearby failed', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMerchants =
    searchText.trim().length > 0
      ? merchants.filter((m) => m.name.includes(searchText.trim()))
      : [];

  const handlePinPress = async (m: MapMerchant) => {
    if (!m.active) return;
    try {
      const detail = await getMerchant(m.id);
      setActiveDetail(detail);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('getMerchant failed', err);
    }
  };

  const handleSheetUseCoupon = (c: MerchantCoupon) => {
    const m = activeDetail;
    setActiveDetail(null);
    if (!m) return;
    onNavigate('coupon-detail', {
      store: m.name,
      detail: c.detail,
      expires: c.expires,
      amount: c.amount,
    });
  };

  const handleSheetClaimShared = (c: SharedCouponSummary) => {
    setActiveDetail(null);
    setSharedCoupon(c);
  };

  const handleSheetScanQR = () => {
    setActiveDetail(null);
    onNavigate('coupon-receive');
  };

  const handleSheetFlag = () => {
    if (!activeDetail) return;
    setSelectedStore(activeDetail.name);
    setSelectedStoreId(activeDetail.id);
    setActiveDetail(null);
    setShowFlag(true);
  };

  const handleSheetBlock = () => {
    if (!activeDetail) return;
    setSelectedStore(activeDetail.name);
    setSelectedStoreId(activeDetail.id);
    setActiveDetail(null);
    setShowBlock(true);
  };

  const handleFlagClose = () => {
    setShowFlag(false);
  };

  const handleBlockConfirm = () => {
    if (selectedStoreId) {
      blockMerchant(selectedStoreId).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('blockMerchant failed', err);
      });
      // Optimistically drop the blocked merchant from the local marker set.
      setMerchants((prev) => prev.filter((m) => m.id !== selectedStoreId));
    }
    setShowBlock(false);
  };

  const handleBlockClose = () => {
    setShowBlock(false);
  };

  // Fire-and-forget flag submission, invoked when FlagStoreModal completes.
  // FlagStoreModal owns its own UI state for reason selection; we surface its
  // close handler and submit when we have a selected store.
  const submitFlag = (reason: string) => {
    if (!selectedStoreId) return;
    flagMerchant(selectedStoreId, reason).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('flagMerchant failed', err);
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapContainer}>
        <NeoBrutMap>
          {merchants
            .filter((m) => m.active)
            .map((m) => (
              <NeoTeardropPin
                key={m.id}
                coordinate={{ latitude: m.lat, longitude: m.lng }}
                active
                count={m.couponCount}
                hasShared={false}
                onPress={() => handlePinPress(m)}
              />
            ))}
        </NeoBrutMap>

        {/* Search bar — pushed below the notch */}
        <View style={[styles.searchBar, { top: insets.top + 8 }]}>
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

        {/* Search results dropdown — sits just under the search bar */}
        {filteredMerchants.length > 0 && (
          <View style={[styles.dropdown, { top: insets.top + 70 }]}>
            {filteredMerchants.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  setSearchText(m.name);
                  void handlePinPress(m);
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

        {/* Loading indicator while nearby merchants are being fetched */}
        {loading && (
          <View style={[styles.loadingBox, { top: insets.top + 70 }]} testID="map-loading">
            <ActivityIndicator size="small" color={colors.fg} />
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
      </View>

      <FlagStoreModal
        visible={showFlag}
        store={selectedStore}
        onClose={handleFlagClose}
        onSubmit={submitFlag}
      />
      <BlockStoreModal
        visible={showBlock}
        store={selectedStore}
        onConfirm={handleBlockConfirm}
        onClose={handleBlockClose}
      />
      <SharedCouponModal
        visible={sharedCoupon !== null}
        coupon={sharedCoupon}
        onClaim={() => setSharedCoupon(null)}
        onClose={() => setSharedCoupon(null)}
      />
      <MerchantSheet
        visible={activeDetail !== null}
        merchant={activeDetail}
        onClose={() => setActiveDetail(null)}
        onUseCoupon={handleSheetUseCoupon}
        onClaimSharedCoupon={handleSheetClaimShared}
        onScanQR={handleSheetScanQR}
        onFlag={handleSheetFlag}
        onBlock={handleSheetBlock}
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
  loadingBox: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
});
