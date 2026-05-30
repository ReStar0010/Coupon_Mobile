import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Location from 'expo-location';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

const APP_LOGO = require('@/assets/adaptive-icon.png');
import NeoBrutMap, { NeoBrutMapHandle } from './NeoBrutMap';
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
import { track } from '@/src/services/analytics/posthog';
import Coachmark from '@/src/features/onboarding/Coachmark';
import { OnboardingAnchor, ANCHOR } from '@/src/components/onboarding/onboardingAnchors';

interface MapScreenProps {
  onNavigate: (screen: string, params?: object) => void;
}

// Fallback centre point if device geolocation is unavailable (Taipei).
const FALLBACK_LAT = 25.0478;
const FALLBACK_LNG = 121.5318;
// `listNearby` is called without a radius — the backend treats that as
// "return every store, no proximity filter" so the map renders all pins
// regardless of how far the user is from a particular store. distanceKm is
// still computed server-side for sorting.
// Belt-and-suspenders cap so the loading spinner never wedges if the network
// request stalls past axios's own timeout. The interceptor's 401 refresh path
// is the most plausible source of an unresolved promise here.
const LOAD_SAFETY_TIMEOUT_MS = 15_000;
// Default delta used when re-centering on the user's current fix. ~0.01 ≈
// 1 km square — tight enough to feel "here" without losing nearby pins.
const LOCATE_DELTA = 0.01;

/** Convert an API `Merchant` to the marker-level shape used by the map. */
function toMapMerchant(m: Merchant): MapMerchant {
  const count = m.couponCount ?? 0;
  return {
    id: m.id,
    name: m.name,
    lat: m.lat,
    lng: m.lng,
    couponCount: count,
    active: true,
    hasSharedCoupons: m.hasSharedCoupons ?? false,
  };
}

export default function MapScreen({ onNavigate }: MapScreenProps): React.JSX.Element {
  const [merchants, setMerchants] = useState<MapMerchant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // True once the OS has stopped showing the location prompt (user picked
  // "Don't Allow" or selected a non-promptable option). When this is set,
  // the error tile becomes a Settings deep-link instead of a retry button.
  const [locationDeniedPermanent, setLocationDeniedPermanent] = useState(false);
  const [activeDetail, setActiveDetail] = useState<MerchantDetail | null>(null);
  const [showFlag, setShowFlag] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [sharedCoupon, setSharedCoupon] = useState<SharedCoupon | null>(null);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [locating, setLocating] = useState<boolean>(false);
  // Live user position — kept so the post-claim nearby re-fetch can recenter
  // on the user. The visible "you are here" indicator is the map's own native
  // dot (showsUserLocation), gated on location permission having been granted
  // — we no longer draw a custom marker.
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  // Ref-based in-flight guard. Using state in the callback's deps would
  // re-memoise on every transition (and the rapid-press guard would be
  // ordering-dependent on the disabled prop arriving before the next
  // press). A ref is the canonical "do not re-render on flip" pattern.
  const locatingRef = useRef<boolean>(false);
  const mapRef = useRef<NeoBrutMapHandle | null>(null);
  // Tracked across the lifetime of the component so async paths (retry,
  // locate) can skip state updates after unmount instead of warning.
  const mountedRef = useRef<boolean>(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Live position subscription so the post-claim re-fetch can recenter on the
  // user, and permission gate for the map's native "you are here" dot.
  // expo-location returns a subscription whose .remove() we MUST call on
  // unmount; if we don't, the OS keeps the GPS radio hot and burns battery.
  useEffect(() => {
    let positionSub: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Read-only permission check — never prompts. The bottom-right locate
        // button owns the explicit `requestForegroundPermissionsAsync()`
        // permission prompt; this effect only piggy-backs on whatever was
        // already granted in this or a previous session.
        const perm = await Location.getForegroundPermissionsAsync();
        if (cancelled || !perm.granted) return;
        // Permission already granted — let the map render its native user dot.
        setHasLocationPermission(true);
        positionSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            if (cancelled) return;
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          },
        );
      } catch {
        // Permission denied or hardware unavailable — fall through silently.
        // The native dot stays off; the user can still hit the locate button.
      }
    })();

    return () => {
      cancelled = true;
      positionSub?.remove();
    };
  }, []);

  const fetchNearby = useCallback(
    async (lat: number, lng: number): Promise<void> => {
      try {
        const result = await listNearby(lat, lng);
        if (!mountedRef.current) return;
        setMerchants(result.map(toMapMerchant));
        setLoadError(null);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('listNearby failed', err);
        if (!mountedRef.current) return;
        setLoadError(err instanceof Error ? err.message : '無法載入店家');
      }
    },
    [],
  );

  const loadInitial = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setLoadError(null);
    try {
      await fetchNearby(FALLBACK_LAT, FALLBACK_LNG);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchNearby]);

  useEffect(() => {
    let cancelled = false;
    // Belt-and-suspenders: if the request stalls past LOAD_SAFETY_TIMEOUT_MS
    // (e.g. interceptor refresh loop never resolves), flip the spinner off so
    // the user can retry instead of staring at a frozen indicator.
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setLoading((prev) => {
          if (prev) {
            setLoadError('讀取逾時，請重試');
          }
          return false;
        });
      }
    }, LOAD_SAFETY_TIMEOUT_MS);

    (async () => {
      try {
        const result = await listNearby(FALLBACK_LAT, FALLBACK_LNG);
        if (!cancelled) {
          setMerchants(result.map(toMapMerchant));
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.warn('listNearby failed', err);
          setLoadError(err instanceof Error ? err.message : '無法載入店家');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  /**
   * Bottom-right locate button — Google-Maps-style one-shot recenter:
   *   1. Ask for foreground location permission
   *   2. Read the current device position
   *   3. Animate the map camera to that position
   *   4. Re-fetch /api/merchants/nearby/ with those coords
   * When permission is denied we surface the failure inline rather than
   * silently swallowing the press; the FALLBACK_LAT/LNG centre stays.
   */
  const handleLocatePress = useCallback(async (): Promise<void> => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!mountedRef.current) return;
      if (!perm.granted) {
        // canAskAgain === false means the OS will silently resolve future
        // request*PermissionsAsync calls; the only escape is Settings.
        if (perm.canAskAgain === false) {
          setLocationDeniedPermanent(true);
          setLoadError('定位權限已關閉');
        } else {
          setLocationDeniedPermanent(false);
          setLoadError('請允許定位權限');
        }
        return;
      }
      setLocationDeniedPermanent(false);
      setHasLocationPermission(true);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!mountedRef.current) return;
      const { latitude, longitude } = position.coords;
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: LOCATE_DELTA,
          longitudeDelta: LOCATE_DELTA,
        },
        600,
      );
      await fetchNearby(latitude, longitude);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('locate failed', err);
      if (mountedRef.current) {
        setLoadError(err instanceof Error ? err.message : '無法取得目前位置');
      }
    } finally {
      // locatingRef is always reset even after unmount so a remount doesn't
      // inherit a stale "in-flight" state from the prior instance.
      locatingRef.current = false;
      if (mountedRef.current) setLocating(false);
    }
  }, [fetchNearby]);

  const filteredMerchants =
    searchText.trim().length > 0
      ? merchants.filter((m) => m.name.includes(searchText.trim()))
      : [];

  const handlePinPress = async (m: MapMerchant) => {
    if (!m.active) return;
    try {
      const detail = await getMerchant(m.id);
      setActiveDetail(detail);
      track('map.merchant_opened', { merchantId: m.id, couponCount: m.couponCount });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('getMerchant failed', err);
    }
  };

  const handleSheetUseCoupon = (c: MerchantCoupon) => {
    const m = activeDetail;
    setActiveDetail(null);
    if (!m) return;
    // Pass the real coupon id so this lands on the same detail page as the
    // CouPro home entry. Without it the route wrapper falls back to the store
    // name as the id and the detail fetch fails.
    onNavigate('coupon-detail', {
      id: c.id,
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
        <NeoBrutMap ref={mapRef} showsUserLocation={hasLocationPermission}>
          {merchants
            .filter((m) => m.active)
            .map((m) => (
              <NeoTeardropPin
                key={m.id}
                coordinate={{ latitude: m.lat, longitude: m.lng }}
                active
                count={m.couponCount}
                hasShared={m.hasSharedCoupons}
                onPress={() => handlePinPress(m)}
              />
            ))}
        </NeoBrutMap>

        {/* Search bar — pushed below the notch */}
        <OnboardingAnchor id={ANCHOR.mapSearch} style={[styles.searchBar, { top: insets.top + 8 }]}>
          <View style={[styles.searchLogoBox, { overflow: 'hidden' }]}>
            <Image
              source={APP_LOGO}
              style={{ width: 34, height: 34 }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
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
        </OnboardingAnchor>

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

        {/* Error tile — when location is permanently denied, route the press
            to system Settings (the only path back). Otherwise default to a
            retry of loadInitial. */}
        {!loading && loadError && (
          <Pressable
            testID="map-error"
            accessibilityRole="button"
            accessibilityLabel={
              locationDeniedPermanent
                ? `${loadError} 點擊前往設定`
                : `${loadError} 點擊重試`
            }
            onPress={() => {
              if (locationDeniedPermanent) {
                void Linking.openSettings();
              } else {
                void loadInitial();
              }
            }}
            style={[styles.errorTile, { top: insets.top + 70 }]}
          >
            <Text style={styles.errorTileText}>{loadError}</Text>
            <Text style={styles.errorTileHint}>
              {locationDeniedPermanent ? '點擊前往設定開啟' : '點擊重試'}
            </Text>
          </Pressable>
        )}

        {/* Location button — request permission, re-centre on current device fix */}
        <Pressable
          testID="locate-btn"
          accessibilityRole="button"
          accessibilityLabel="定位我的位置"
          accessibilityState={{ disabled: locating }}
          onPress={handleLocatePress}
          disabled={locating}
          style={[styles.locationBtn, locating && styles.locationBtnLoading]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.fg} />
          ) : (
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
          )}
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
        onClaim={() => {
          setSharedCoupon(null);
          const loc = userLocation;
          fetchNearby(loc?.latitude ?? FALLBACK_LAT, loc?.longitude ?? FALLBACK_LNG);
        }}
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
      <Coachmark screen="map" />
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
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
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
  locationBtnLoading: {
    opacity: 0.7,
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
  errorTile: {
    position: 'absolute',
    alignSelf: 'center',
    left: 16,
    right: 16,
    zIndex: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    shadowColor: colors.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    alignItems: 'center',
    gap: 2,
  },
  errorTileText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.fg,
  },
  errorTileHint: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    color: colors.muted,
  },
});
