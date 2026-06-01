import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, TextInput, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { redeemCoupon, type RedeemResponse } from '@/src/services/api/coupons';
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

/** Format the BE `redeemed_at` ISO timestamp as local `YYYY/MM/DD HH:MM`. */
function formatRedeemedAt(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CouponUseQRScreen({
  onNavigate,
  params,
}: CouponScreenProps): React.JSX.Element {
  const [torch, setTorch] = useState(false);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<RedeemResponse | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanned = useRef(false);
  const insets = useSafeAreaInsets();
  const { refreshWallet } = useWallet();

  const store = params.store ?? '阿明早餐店';
  const amount = params.amount ?? 25;
  const expires = params.expires ?? '11/08';

  const handleScan = async (scannedCode?: string): Promise<void> => {
    if (scanned.current || success) return;

    // Prefer the camera-scanned code. Fall back to params.redeem_code
    // (set when the user lands here from a deep-link with the code
    // pre-supplied). Never fall back to a literal "SIMULATED" placeholder
    // — the dev-only bypass button that relied on that has been removed.
    const code = scannedCode ?? params.redeem_code;
    if (!code) return;
    scanned.current = true;
    const id = params.id;

    try {
      let redeemed: RedeemResponse | null = null;
      if (id) {
        redeemed = await redeemCoupon(id, code);
      }
      track('coupon.redeem_succeeded', { couponId: id });
      // Keep the server's authoritative redemption details so the merchant
      // sees exactly which coupon was redeemed. The confirmation overlay now
      // stays up until the merchant taps 確認 — no silent auto-dismiss.
      setResult(redeemed);
      setSuccess(true);
      // BE +1 hook (kind=COUPON_REDEEM) credits the gem; refresh to reflect it.
      await refreshWallet();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redeem failed';
      setRedeemError(msg);
      scanned.current = false;
      console.warn('[CouponUseQRScreen] redeemCoupon failed:', msg);
    }
  };

  const handleManualSubmit = (): void => {
    const trimmed = manualCode.trim();
    if (!trimmed || isSubmitting) return;
    Keyboard.dismiss();
    setIsSubmitting(true);
    void handleScan(trimmed).finally(() => setIsSubmitting(false));
  };

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission, requestPermission]);

  // Server-authoritative display values, with param fallbacks for the
  // manual-code and deep-link paths where the response may be partial.
  const couponName = result?.coupon_name?.trim() || '優惠券';
  const couponDetail = result?.coupon_detail?.trim() || params.detail || '';
  const displaySavings =
    result?.savings_amount != null && Number.isFinite(result.savings_amount)
      ? result.savings_amount
      : amount;
  const redeemedAtText = formatRedeemedAt(result?.redeemed_at);

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
          <View style={s.successOverlay} testID="redeem-confirm-overlay">
            <View style={s.confirmCardOuter}>
              <View style={s.confirmCardShadow} />
              <View style={s.confirmCard}>
                <View style={s.confirmHeaderRow}>
                  <View style={s.successIcon}>
                    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M20 6L9 17L4 12"
                        stroke="#fff"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <Text style={s.confirmHeader}>核銷成功</Text>
                </View>

                <Text style={s.confirmCouponName} numberOfLines={2}>
                  {couponName}
                </Text>
                {couponDetail ? (
                  <Text style={s.confirmDetail} numberOfLines={2}>
                    {couponDetail}
                  </Text>
                ) : null}

                <View style={s.confirmSavingsRow}>
                  <Text style={s.confirmSavingsLabel}>折抵金額</Text>
                  <Text style={s.confirmSavings}>${displaySavings}</Text>
                </View>

                <View style={s.confirmMetaBlock}>
                  <View style={s.confirmMetaRow}>
                    <Text style={s.confirmMetaLabel}>店家</Text>
                    <Text style={s.confirmMetaValue} numberOfLines={1}>
                      {store}
                    </Text>
                  </View>
                  {redeemedAtText ? (
                    <View style={s.confirmMetaRow}>
                      <Text style={s.confirmMetaLabel}>核銷時間</Text>
                      <Text style={s.confirmMetaValue}>{redeemedAtText}</Text>
                    </View>
                  ) : null}
                  {result?.redemption_id != null ? (
                    <View style={s.confirmMetaRow}>
                      <Text style={s.confirmMetaLabel}>核銷編號</Text>
                      <Text style={s.confirmMetaValueMono}>#{result.redemption_id}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={s.confirmGem}>顧客 +1 顆寶石</Text>

                <View style={s.confirmBtnOuter}>
                  <View style={s.confirmBtnShadow} />
                  <Pressable
                    testID="redeem-confirm"
                    onPress={() => onNavigate('home')}
                    style={s.confirmBtn}
                  >
                    <Text style={s.confirmBtnText}>確認</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
      <View style={s.manualSection}>
        <Text style={s.manualLabel}>或手動輸入兌換碼</Text>
        <View style={s.manualRow}>
          <View style={s.inputWrap}>
            <TextInput
              testID="redeem-code-input"
              style={s.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="輸入 6 位兌換碼"
              placeholderTextColor="rgba(255,255,255,0.3)"
              maxLength={6}
              keyboardType="number-pad"
              returnKeyType="go"
              onSubmitEditing={handleManualSubmit}
              editable={!success && !isSubmitting}
            />
          </View>
          <View style={s.submitOuter}>
            <View style={s.submitShadow} />
            <Pressable
              testID="redeem-code-submit"
              onPress={handleManualSubmit}
              disabled={!manualCode.trim() || success || isSubmitting}
              style={[
                s.submitBtn,
                (!manualCode.trim() || success || isSubmitting) && s.submitBtnDisabled,
              ]}
            >
              <Text style={s.submitBtnText}>
                {isSubmitting ? '核銷中…' : '確認核銷'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View style={s.footer}>
        {redeemError ? (
          <View style={s.errorBanner} testID="redeem-error">
            <Text style={s.errorText}>{redeemError}</Text>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  confirmCardOuter: { position: 'relative', width: '100%', maxWidth: 360 },
  confirmCardShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  confirmCard: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  confirmHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.green,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmHeader: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: colors.fg,
    letterSpacing: -0.5,
  },
  confirmCouponName: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.fg,
    letterSpacing: -0.6,
  },
  confirmDetail: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  confirmSavingsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.yellowLight,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
  },
  confirmSavingsLabel: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg },
  confirmSavings: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 30,
    color: colors.fg,
    letterSpacing: -0.5,
  },
  confirmMetaBlock: { marginTop: 16, gap: 8 },
  confirmMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirmMetaLabel: { fontFamily: fontFamilies.regular, fontSize: 13, color: colors.muted },
  confirmMetaValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.fg,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  confirmMetaValueMono: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 13,
    color: colors.fg,
  },
  confirmGem: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.muted,
    marginTop: 16,
    textAlign: 'center',
  },
  confirmBtnOuter: { position: 'relative', marginTop: 18 },
  confirmBtnShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  confirmBtn: {
    height: 52,
    backgroundColor: colors.green,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    color: '#fff',
    letterSpacing: 1,
  },
  manualSection: { paddingHorizontal: 16, paddingTop: 14, zIndex: 5 },
  manualLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    letterSpacing: 0.44,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
    textAlign: 'center',
  },
  manualRow: { flexDirection: 'row', gap: 10 },
  inputWrap: { flex: 1 },
  manualInput: {
    height: 46,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 6,
    paddingHorizontal: 14,
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 18,
    letterSpacing: 6,
    color: '#fff',
    textAlign: 'center',
  },
  submitOuter: { position: 'relative' },
  submitShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  submitBtn: {
    height: 46,
    paddingHorizontal: 18,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontFamily: fontFamilies.extraBold, fontSize: 13, color: colors.fg },
  footer: { padding: 12, paddingHorizontal: 16, paddingBottom: 14, zIndex: 5 },
  errorBanner: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.red,
    borderRadius: 6,
  },
  errorText: { fontFamily: fontFamilies.bold, fontSize: 12, color: '#fff' },
});
