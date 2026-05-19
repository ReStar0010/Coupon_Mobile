import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { redeemCoupon } from '@/src/services/api/coupons';
import { useWallet } from '@/src/state/WalletContext';
import { track } from '@/src/services/analytics/posthog';
import PermissionDeniedView from '@/src/components/ui/PermissionDeniedView';
interface NavParams {
  id?: string;
  store?: string;
  detail?: string;
  expires?: string;
  amount?: number;
  redeem_code?: string;
}
interface CouponScreenProps {
  onNavigate: (screen: string, params?: NavParams) => void;
  // Kept as a no-op placeholder; gem credit is now driven by the BE +1 hook.
  setGems: (fn: (prev: number) => number) => void;
  params: NavParams;
}

const CORNERS: Array<['top' | 'bottom', 'left' | 'right']> = [
  ['top', 'left'],
  ['top', 'right'],
  ['bottom', 'left'],
  ['bottom', 'right'],
];

function ScanLine(): React.JSX.Element {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 240] });
  return (
    <Animated.View
      style={[scanStyles.line, { transform: [{ translateY }] }]}
      pointerEvents="none"
    />
  );
}

const scanStyles = StyleSheet.create({
  line: {
    position: 'absolute',
    left: 28,
    right: 28,
    height: 2,
    backgroundColor: colors.yellow,
    borderRadius: 1,
    zIndex: 5,
  },
});

export default function CouponUseQRScreen({
  onNavigate,
  params,
}: CouponScreenProps): React.JSX.Element {
  const [torch, setTorch] = useState(false);
  const [success, setSuccess] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { refreshWallet } = useWallet();

  const store = params.store ?? '阿明早餐店';
  const amount = params.amount ?? 25;
  const expires = params.expires ?? '11/08';

  const handleScan = async (scannedCode?: string): Promise<void> => {
    if (scanned.current || success) return;
    scanned.current = true;

    const code = scannedCode ?? params.redeem_code ?? 'SIMULATED';
    const id = params.id;

    try {
      if (id) {
        await redeemCoupon(id, code);
      }
      track('coupon.redeem_succeeded', { couponId: id });
      setSuccess(true);
      // BE +1 hook (kind=COUPON_REDEEM) credits the gem; refresh to reflect it.
      await refreshWallet();
      successTimerRef.current = setTimeout(() => {
        successTimerRef.current = null;
        onNavigate('home');
      }, 2600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redeem failed';
      setRedeemError(msg);
      scanned.current = false;
      console.warn('[CouponUseQRScreen] redeemCoupon failed:', msg);
    }
  };

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  useEffect(
    () => () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    },
    [],
  );

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.header}>
        <View style={s.backOuter}>
          <View style={s.backShadow} />
          <Pressable onPress={() => onNavigate('coupon-detail', params)} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </Pressable>
        </View>
        <Text style={s.headerTitle}>掃描店家 QR</Text>
      </View>
      <View style={s.couponBanner}>
        <View style={s.bannerShadow} />
        <View style={s.bannerCard}>
          <Text style={s.bannerAmt}>${amount}</Text>
          <View style={s.bannerInfo}>
            <Text style={s.bannerStore}>{store}</Text>
            <Text style={s.bannerSub}>現金折抵券 · 到期 {expires}</Text>
          </View>
          <View style={s.expiryTag}>
            <Text style={s.expiryTagText}>⚡ 7天</Text>
          </View>
        </View>
      </View>
      <View style={[s.scanArea, torch && s.scanAreaTorch]}>
        <View style={s.bgOverlay} />
        {CORNERS.map(([v, h], i) => (
          <View key={i} style={[s.corner, { [v]: 18, [h]: 18 }]}>
            <View style={[s.cornerH, { [v]: 0, [h]: 0 }]} />
            <View style={[s.cornerV, { [v]: 0, [h]: 0 }]} />
          </View>
        ))}
        <ScanLine />
        <View style={s.torchBtnOuter}>
          <Pressable
            onPress={() => setTorch((t) => !t)}
            style={[s.torchBtn, torch && s.torchBtnActive]}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 2l-1 6H5l6 14 1-8h3L9 2z"
                stroke={torch ? colors.fg : 'rgba(255,255,255,0.7)'}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>
        {permission?.granted ? (
          <CameraView
            style={s.camera}
            facing="back"
            enableTorch={torch}
            onBarcodeScanned={success ? undefined : (e) => { void handleScan(e?.data); }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        ) : (
          <PermissionDeniedView
            title="需要相機權限"
            description="開啟相機以掃描店家 QR Code 並完成核銷"
            onRetry={permission?.canAskAgain ? () => { void requestPermission(); } : undefined}
          />
        )}
        <Text style={s.scanHint}>將店家 QR Code 對準框內</Text>
        {success && (
          <View style={s.successOverlay}>
            <View style={s.successIcon}>
              <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 6L9 17L4 12"
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={s.successTitle}>使用成功！</Text>
            <Text style={s.successSub}>+1 顆寶石</Text>
            <Text style={s.successReturn}>返回首頁中…</Text>
          </View>
        )}
      </View>
      <View style={s.footer}>
        {redeemError ? (
          <View style={s.errorBanner} testID="redeem-error">
            <Text style={s.errorText}>{redeemError}</Text>
          </View>
        ) : null}
        <View style={s.simBtnOuter}>
          {!success && <View style={s.simBtnShadow} />}
          <Pressable
            onPress={() => { void handleScan(); }}
            disabled={success}
            style={[s.simBtn, success && s.simBtnDone]}
          >
            <Text style={[s.simBtnText, success && s.simBtnTextDone]}>
              {success ? '掃描成功 ✓' : '模擬掃描成功 ▶'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 2,
    zIndex: 5,
  },
  backOuter: { position: 'relative', width: 36, height: 36 },
  backShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: '#fff' },
  headerTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    letterSpacing: -0.36,
    color: '#fff',
    flex: 1,
  },
  couponBanner: { position: 'relative', marginHorizontal: 16, marginBottom: 14, zIndex: 5 },
  bannerShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: -2,
    bottom: -2,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  bannerCard: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerAmt: { fontFamily: fontFamilies.monoSemiBold, fontSize: 26, color: colors.fg },
  bannerInfo: { flex: 1 },
  bannerStore: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg },
  bannerSub: { fontFamily: fontFamilies.regular, fontSize: 11, color: 'rgba(51,51,51,0.65)' },
  expiryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.fg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 4,
  },
  expiryTagText: { fontFamily: fontFamilies.monoSemiBold, fontSize: 10, color: colors.yellow },
  scanArea: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: '#0d0d0d',
    position: 'relative',
  },
  scanAreaTorch: { backgroundColor: '#1a1208' },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  corner: { position: 'absolute', width: 30, height: 30, pointerEvents: 'none' } as any,
  cornerH: {
    position: 'absolute',
    width: 30,
    height: 3,
    backgroundColor: colors.yellow,
    borderRadius: 1,
  } as any,
  cornerV: {
    position: 'absolute',
    width: 3,
    height: 30,
    backgroundColor: colors.yellow,
    borderRadius: 1,
  } as any,
  torchBtnOuter: { position: 'absolute', top: 14, right: 14, zIndex: 6 },
  torchBtn: {
    width: 34,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchBtnActive: { backgroundColor: colors.yellow, borderColor: colors.border },
  camera: { ...StyleSheet.absoluteFillObject },
  noCamera: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  noCameraText: { fontFamily: fontFamilies.regular, fontSize: 14, color: 'rgba(255,255,255,0.55)' },
  scanHint: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    letterSpacing: 0.44,
    color: 'rgba(255,255,255,0.55)',
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.green,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    color: '#fff',
    letterSpacing: -0.4,
  },
  successSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 6,
  },
  successReturn: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 8,
  },
  footer: { padding: 12, paddingHorizontal: 16, paddingBottom: 14, zIndex: 5 },
  simBtnOuter: { position: 'relative' },
  simBtnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  simBtn: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  simBtnDone: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' },
  simBtnText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 15,
    letterSpacing: 0.3,
    color: colors.fg,
  },
  simBtnTextDone: { color: 'rgba(255,255,255,0.3)' },
  errorBanner: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.red,
    borderRadius: 6,
  },
  errorText: { fontFamily: fontFamilies.bold, fontSize: 12, color: '#fff' },
});
