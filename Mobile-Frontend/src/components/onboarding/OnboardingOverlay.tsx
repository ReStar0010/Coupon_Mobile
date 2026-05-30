import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { colors } from '@/src/theme/colors';
import { ANCHOR, useAnchorRegistry, type MeasuredRect } from './onboardingAnchors';

const { height: SCREEN_H } = Dimensions.get('window');

// Retry budget for the first measurement after a step changes. measureInWindow
// can return all-zeros for a frame or two right after mount/layout, so we poll
// briefly rather than giving up on the first miss.
const MEASURE_MAX_ATTEMPTS = 8;
const MEASURE_RETRY_MS = 50;

// Spotlight defaults: a little breathing room around the measured element and
// a rounded-rect corner unless a step overrides it (e.g. the round wheel).
const SPOT_PADDING = 6;
const SPOT_RADIUS = 8;
const TOOLTIP_GAP = 14;
// Where the tooltip sits when a step has no measurable anchor (stale/abstract
// steps, or a list that's currently empty) — roughly centered, no spotlight.
const FALLBACK_TOOLTIP_RATIO = 0.4;
// Place the tooltip above the spotlight once the highlight sits in the lower
// ~half of the screen, so the card never runs off the bottom edge.
const TOOLTIP_ABOVE_THRESHOLD = 0.52;

interface OnboardingStep {
  text: string;
  /** Anchor id of the real element to spotlight; omit for a centered tooltip. */
  anchor?: string;
  padding?: number;
  radius?: number;
}

export type ScreenKey = 'home' | 'map' | 'spinner' | 'coupon-detail' | 'coupon-share' | 'settings';

const ONBOARDING: Record<ScreenKey, OnboardingStep[]> = {
  home: [
    { text: '歡迎使用 CouPro！這是你的優惠券錢包。', anchor: ANCHOR.homeWallet },
    { text: '這裡顯示你的 CouPoint 餘額，累積可換現金券。', anchor: ANCHOR.homeBalance },
    { text: '點「兌換 →」，用 CouPoints 選擇面額換現金券。', anchor: ANCHOR.homeRedeem },
    { text: '有寶石嗎？點這裡去 Spinner 用寶石抽積分！', anchor: ANCHOR.homeGem },
    { text: '點✈送出優惠券分享給別人，或點券本身查看詳情。', anchor: ANCHOR.homeCoupon },
  ],
  map: [
    { text: 'CouMap 顯示附近有共享優惠券的店家。', anchor: ANCHOR.mapSearch },
    // Steps below describe a map pin and the merchant bottom-sheet, which are
    // geographic / not open during the coach-mark — no measurable native
    // anchor, so they render as centered tooltips.
    { text: '黃色圖釘表示有可領取的優惠券，點擊查看！' },
    { text: '「我的優惠券」可以在此店直接使用。' },
    { text: '「CouMap 上的優惠券」是別人分享的，可以免費領取。' },
    { text: '按「領取」掃描店家 QR Code 取得實體優惠券。' },
  ],
  spinner: [
    { text: '歡迎來到 Spinner！用寶石來抽 CouPoints。', anchor: ANCHOR.spinnerWheel, radius: 160 },
    { text: '調整寶石數量，越多寶石 = 更高的最低倍率 (FLOOR)。', anchor: ANCHOR.spinnerBet },
    { text: '揪友加入！人數越多，FLOOR 也會提升。', anchor: ANCHOR.spinnerInvite },
    { text: '點 + 讓朋友加入後才能開始，圓圈變綠就準備好了。', anchor: ANCHOR.spinnerSlots, radius: 24 },
    { text: '一切就緒後按 SPIN! 開始旋轉！', anchor: ANCHOR.spinnerSpin },
  ],
  'coupon-detail': [
    { text: '這是你的優惠券詳情。', anchor: ANCHOR.detailTicket },
    { text: '按「立即使用」前往掃描店家 QR Code。', anchor: ANCHOR.detailUse },
    { text: '按「分享賺寶石」把券讓給別人，有人領用後可賺寶石。', anchor: ANCHOR.detailShare },
  ],
  'coupon-share': [
    { text: '分享優惠券給別人用，有人領走後你可以賺寶石！', anchor: ANCHOR.shareReward },
    // No coupon-preview element exists on this screen — centered fallback.
    { text: '這是你準備分享的優惠券。' },
    { text: '可以附上一句話給領券的人，讓分享更有溫度。', anchor: ANCHOR.shareNote },
    { text: '選擇「CouMap」釋出給附近的人，或「連結」傳給特定朋友。', anchor: ANCHOR.shareTarget },
    { text: '選好後按這裡確認分享，寶石馬上入帳！', anchor: ANCHOR.shareConfirm },
  ],
  settings: [
    { text: '這裡是設定頁，可以調整你的帳號與通知偏好。', anchor: ANCHOR.settingsProfile },
    // Push-notification and privacy-mode toggles aren't present yet — these
    // render as centered tooltips until the controls exist.
    { text: '開啟「推播通知」不錯過任何限時優惠券。' },
    { text: '「隱私模式」開啟後，其他人無法在 CouMap 看到你的位置。' },
  ],
};

/** Promise wrapper around a host node's measureInWindow. */
function measureNode(
  node: { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null,
): Promise<MeasuredRect | null> {
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

interface OnboardingOverlayProps {
  screenKey: ScreenKey;
  step: number;
  onNext: () => void;
  onDone: () => void;
}

export default function OnboardingOverlay({
  screenKey,
  step,
  onNext,
  onDone,
}: OnboardingOverlayProps): React.JSX.Element | null {
  const registry = useAnchorRegistry();
  const containerRef = useRef<View>(null);
  const [rect, setRect] = useState<MeasuredRect | null>(null);

  const steps = ONBOARDING[screenKey] ?? [];
  const inRange = step >= 0 && step < steps.length;
  const current = inRange ? steps[step] : undefined;
  const anchorId = current?.anchor;

  // Measure the current step's anchor (relative to the overlay's own window
  // origin, so it's correct even when mounted inside a SafeAreaView inset).
  useEffect(() => {
    if (!registry || !anchorId) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const attempt = async (): Promise<void> => {
      if (cancelled) return;
      const target = await registry.measure(anchorId);
      const container = await measureNode(containerRef.current);
      if (cancelled) return;
      if (target && container) {
        setRect({
          x: target.x - container.x,
          y: target.y - container.y,
          width: target.width,
          height: target.height,
        });
        return;
      }
      attempts += 1;
      if (attempts < MEASURE_MAX_ATTEMPTS) {
        timer = setTimeout(attempt, MEASURE_RETRY_MS);
      } else {
        setRect(null);
      }
    };

    setRect(null);
    timer = setTimeout(attempt, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [registry, screenKey, step, anchorId]);

  if (!steps.length || !current) return null;

  const isLast = step === steps.length - 1;
  const padding = current.padding ?? SPOT_PADDING;
  const radius = current.radius ?? SPOT_RADIUS;

  const spot = rect
    ? {
        top: rect.y - padding,
        left: rect.x - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  // Position the tooltip below the spotlight, or above it when the highlight
  // is low on screen. With no spotlight, fall back to a centered card.
  const above = spot ? spot.top > SCREEN_H * TOOLTIP_ABOVE_THRESHOLD : false;
  const tooltipTop = spot
    ? above
      ? undefined
      : Math.min(spot.top + spot.height + TOOLTIP_GAP, SCREEN_H - 180)
    : SCREEN_H * FALLBACK_TOOLTIP_RATIO;
  const tooltipBottom = above && spot ? Math.max(90, SCREEN_H - spot.top + 10) : undefined;

  const handlePress = isLast ? onDone : onNext;

  return (
    <Pressable
      ref={containerRef}
      style={styles.container}
      onPress={handlePress}
      testID="onboarding-overlay"
    >
      {/* Dark overlay */}
      <View style={styles.backdrop} pointerEvents="none" />

      {/* Spotlight highlight border (only when the target was measured) */}
      {spot && (
        <View
          pointerEvents="none"
          style={[
            styles.spotlight,
            {
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              borderRadius: radius,
            },
          ]}
        />
      )}

      {/* Tooltip card */}
      <Pressable
        onPress={handlePress}
        style={[
          styles.tooltip,
          tooltipTop !== undefined ? { top: tooltipTop } : undefined,
          tooltipBottom !== undefined ? { bottom: tooltipBottom } : undefined,
        ]}
        testID="onboarding-tooltip"
      >
        {/* Step dots + counter */}
        <View style={styles.stepRow}>
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: i === step ? 18 : 6,
                    backgroundColor: i <= step ? colors.yellow : 'rgba(255,255,255,0.2)',
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.counter}>
            {step + 1}/{steps.length}
          </Text>
        </View>

        <Text style={styles.text}>{current.text}</Text>

        <Pressable onPress={handlePress} style={styles.btn} testID="onboarding-next-btn">
          <Text style={styles.btnText}>{isLast ? '開始使用！' : '下一步 →'}</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  spotlight: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.yellow,
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.fg,
    borderWidth: 3,
    borderColor: colors.yellow,
    borderRadius: 8,
    padding: 18,
    zIndex: 202,
    shadowColor: colors.yellow,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  counter: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
  },
  text: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
  },
  btn: {
    marginTop: 14,
    padding: 11,
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    shadowColor: colors.border,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  btnText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: colors.fg,
  },
});
