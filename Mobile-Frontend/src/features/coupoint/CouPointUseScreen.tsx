import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import CoinIcon from '@/src/components/icons/CoinIcon';
import { submitCouPointSpend } from '@/src/services/api/coupoint';
import { useWallet } from '@/src/state/WalletContext';

interface Props {
  couPoints: number;
  setCouPoints: (fn: (prev: number) => number) => void;
  onNavigate: (screen: string) => void;
}

type Phase = 'scan' | 'amount' | 'success';

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
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });
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

export default function CouPointUseScreen({
  couPoints,
  onNavigate,
}: Props): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('scan');
  const [torch, setTorch] = useState(false);
  const [amount, setAmount] = useState(5);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scanned = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { refreshWallet } = useWallet();

  const maxAmount = Math.floor(couPoints / 5) * 5;
  const canUse = couPoints >= 5;

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  useEffect(() => {
    if (canUse) setAmount(Math.min(5, maxAmount));
  }, [couPoints]);

  useEffect(
    () => () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    },
    [],
  );

  const handleScan = (data?: string): void => {
    if (scanned.current) return;
    scanned.current = true;
    setScannedToken(data ?? 'SIMULATED');
    setPhase('amount');
  };

  const handleConfirm = async (): Promise<void> => {
    if (submitting) return;
    if (!scannedToken) {
      setError('尚未掃描 QR Code');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await submitCouPointSpend(scannedToken, amount);
      setStoreName(resp.store.name);
      await refreshWallet();
      setPhase('success');
      successTimerRef.current = setTimeout(() => {
        successTimerRef.current = null;
        onNavigate('home');
      }, 2600);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '兌換失敗';
      setError(msg || '兌換失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = (): void => {
    setError(null);
    setScannedToken(null);
    scanned.current = false;
    setPhase('scan');
  };

  const decrement = (): void => setAmount((a) => Math.max(5, a - 5));
  const increment = (): void => setAmount((a) => Math.min(maxAmount, a + 5));

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.backOuter}>
          <View style={s.backShadow} />
          <Pressable
            onPress={() => (phase === 'amount' ? setPhase('scan') : onNavigate('home'))}
            style={s.backBtn}
          >
            <Text style={s.backArrow}>←</Text>
          </Pressable>
        </View>
        <Text style={s.headerTitle}>
          {phase === 'scan' ? '掃碼付款' : phase === 'amount' ? '選擇使用金額' : '付款成功'}
        </Text>
      </View>

      {/* Balance banner */}
      <View style={s.balanceBanner}>
        <View style={s.balanceShadow} />
        <View style={s.balanceCard}>
          <CoinIcon size={24} />
          <Text style={s.balanceLabel}>CouPoint 餘額</Text>
          <Text style={s.balanceNum}>{couPoints}</Text>
        </View>
      </View>

      {phase === 'scan' && (
        <>
          <View style={[s.scanArea, torch && s.scanAreaTorch]}>
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
                onBarcodeScanned={(e) => handleScan(e?.data)}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            ) : (
              <View style={s.noCamera}>
                <Text style={s.noCameraText}>需要相機權限</Text>
              </View>
            )}
            <Text style={s.scanHint}>將店家 QR Code 對準框內</Text>
          </View>
          <View style={s.footer}>
            <View style={s.simBtnOuter}>
              <View style={s.simBtnShadow} />
              <Pressable
                testID="sim-scan-btn"
                onPress={() => handleScan('SIMULATED')}
                style={s.simBtn}
              >
                <Text style={s.simBtnText}>模擬掃描成功 ▶</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {phase === 'amount' && (
        <View style={s.amountPhase}>
          {!canUse ? (
            <View style={s.insufficientBox}>
              <Text style={s.insufficientTitle}>餘額不足</Text>
              <Text style={s.insufficientSub}>需要至少 5 CouPoint 才能付款</Text>
            </View>
          ) : (
            <>
              <View style={s.amountCard}>
                <View style={s.amountCardShadow} />
                <View style={s.amountCardInner}>
                  <Text style={s.amountHint}>選擇付款金額（每次 5 的倍數）</Text>
                  <View style={s.stepperRow}>
                    <Pressable
                      onPress={decrement}
                      disabled={amount <= 5}
                      style={[s.stepBtn, amount <= 5 && s.stepBtnDisabled]}
                    >
                      <Text style={[s.stepBtnText, amount <= 5 && s.stepBtnTextDisabled]}>−</Text>
                    </Pressable>
                    <View style={s.amountDisplay}>
                      <CoinIcon size={28} />
                      <Text style={s.amountValue}>{amount}</Text>
                    </View>
                    <Pressable
                      onPress={increment}
                      disabled={amount >= maxAmount}
                      style={[s.stepBtn, amount >= maxAmount && s.stepBtnDisabled]}
                    >
                      <Text style={[s.stepBtnText, amount >= maxAmount && s.stepBtnTextDisabled]}>
                        +
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={s.remainAfter}>付款後餘額：{couPoints - amount} CouPoint</Text>
                </View>
              </View>
              {error && (
                <View testID="coupoint-error" style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                  <Pressable onPress={handleRetry} style={s.retryBtn}>
                    <Text style={s.retryBtnText}>重新掃描</Text>
                  </Pressable>
                </View>
              )}
              <View style={s.confirmOuter}>
                <View style={s.confirmShadow} />
                <Pressable
                  testID="confirm-btn"
                  onPress={() => {
                    void handleConfirm();
                  }}
                  disabled={submitting}
                  style={[s.confirmBtn, submitting && s.confirmBtnDisabled]}
                >
                  <Text style={s.confirmText}>
                    {submitting ? '處理中…' : `確認付款 ${amount} CouPoint`}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      {phase === 'success' && (
        <View style={s.successPhase}>
          <View style={s.successIconWrapper}>
            <View style={s.successIconShadow} />
            <View style={s.successIcon}>
              <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 6L9 17L4 12"
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>
          <Text style={s.successTitle}>付款成功！</Text>
          {storeName ? (
            <Text testID="success-store" style={s.successStore}>{storeName}</Text>
          ) : null}
          <Text style={s.successSub}>已扣除 {amount} CouPoint</Text>
          <Text style={s.successReturn}>返回首頁中…</Text>
        </View>
      )}
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
  balanceBanner: { position: 'relative', marginHorizontal: 16, marginBottom: 14, zIndex: 5 },
  balanceShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: -2,
    bottom: -2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  balanceCard: {
    backgroundColor: '#1E1E22',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  balanceNum: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: '#fff',
    letterSpacing: -0.88,
  },
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
  simBtnText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 15,
    letterSpacing: 0.3,
    color: colors.fg,
  },
  amountPhase: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  amountCard: { position: 'relative', marginBottom: 20 },
  amountCardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  amountCardInner: {
    backgroundColor: '#18181C',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
  },
  amountHint: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 20,
    textAlign: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 18,
  },
  stepBtn: {
    width: 52,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { fontFamily: fontFamilies.extraBold, fontSize: 28, color: '#fff' },
  stepBtnTextDisabled: { color: 'rgba(255,255,255,0.4)' },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  amountValue: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2.24,
    color: '#fff',
  },
  remainAfter: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  confirmOuter: { position: 'relative' },
  confirmShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    color: colors.fg,
    letterSpacing: -0.32,
  },
  insufficientBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: '#fff',
    marginBottom: 8,
  },
  insufficientSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  successPhase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  successIconWrapper: { position: 'relative', width: 80, height: 80, marginBottom: 20 },
  successIconShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.green,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 24,
    color: '#fff',
    letterSpacing: -0.48,
  },
  successStore: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#fff',
    marginTop: 10,
    letterSpacing: -0.2,
  },
  successSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 8,
  },
  confirmBtnDisabled: {
    opacity: 0.55,
  },
  errorBox: {
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 80, 80, 0.12)',
    borderWidth: 2,
    borderColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: '#fff',
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  retryBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#fff',
  },
  successReturn: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 10,
  },
});
