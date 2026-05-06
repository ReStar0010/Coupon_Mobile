import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { colors } from '@/src/theme/colors';

const { height: SCREEN_H } = Dimensions.get('window');

interface SpotConfig {
  top: number;
  left: number;
  width: number;
  height: number;
  radius?: number;
}

type OnboardingStep = string | { text: string; spot: SpotConfig };

export type ScreenKey =
  | 'home'
  | 'map'
  | 'spinner'
  | 'coupon-detail'
  | 'coupon-share'
  | 'settings';

const ONBOARDING: Record<ScreenKey, OnboardingStep[]> = {
  home: [
    { text: '歡迎使用 CouPro！這是你的優惠券錢包。', spot: { top: 108, left: 14, width: 362, height: 178 } },
    { text: '這裡顯示你的 CouPoint 餘額，累積可換現金券。', spot: { top: 118, left: 18, width: 200, height: 116 } },
    { text: '點「兌換 →」，用 CouPoints 選擇面額換現金券。', spot: { top: 118, left: 242, width: 126, height: 50 } },
    { text: '有寶石嗎？點這裡去 Spinner 用寶石抽積分！', spot: { top: 288, left: 14, width: 362, height: 62 } },
    { text: '點✈送出優惠券分享給別人，或點券本身查看詳情。', spot: { top: 512, left: 300, width: 66, height: 58 } },
  ],
  map: [
    { text: 'CouMap 顯示附近有共享優惠券的店家。', spot: { top: 54, left: 14, width: 362, height: 62 } },
    { text: '黃色圖釘表示有可領取的優惠券，點擊查看！', spot: { top: 100, left: 42, width: 72, height: 68, radius: 12 } },
    { text: '「我的優惠券」可以在此店直接使用。', spot: { top: 392, left: 14, width: 362, height: 112 } },
    { text: '「CouMap 上的優惠券」是別人分享的，可以免費領取。', spot: { top: 514, left: 14, width: 362, height: 92 } },
    { text: '按「領取」掃描店家 QR Code 取得實體優惠券。', spot: { top: 696, left: 14, width: 362, height: 52 } },
  ],
  spinner: [
    { text: '歡迎來到抽獎桌！用寶石來抽 CouPoints。', spot: { top: 102, left: 78, width: 234, height: 252 } },
    { text: '調整寶石數量，越多寶石 = 更高的最低倍率 (FLOOR)。', spot: { top: 384, left: 16, width: 354, height: 42 } },
    { text: '揪友加入！人數越多，FLOOR 也會提升。', spot: { top: 616, left: 14, width: 156, height: 48 } },
    { text: '點 + 讓朋友加入後才能開始，圓圈變綠就準備好了。', spot: { top: 616, left: 200, width: 156, height: 48 } },
    { text: '一切就緒後按 SPIN! 開始旋轉！', spot: { top: 684, left: 14, width: 362, height: 56 } },
  ],
  'coupon-detail': [
    { text: '這是你的優惠券詳情。', spot: { top: 104, left: 14, width: 362, height: 244 } },
    { text: '按「立即使用」前往掃描店家 QR Code。', spot: { top: 762, left: 182, width: 192, height: 56 } },
    { text: '按「分享賺寶石」把券讓給別人，有人領用後可賺寶石。', spot: { top: 762, left: 14, width: 192, height: 56 } },
  ],
  'coupon-share': [
    { text: '分享優惠券給別人用，有人領走後你可以賺寶石！', spot: { top: 106, left: 14, width: 362, height: 82 } },
    { text: '這是你準備分享的優惠券。', spot: { top: 192, left: 14, width: 362, height: 52 } },
    { text: '可以附上一句話給領券的人，讓分享更有溫度。', spot: { top: 248, left: 14, width: 362, height: 112 } },
    { text: '選擇「CouMap」釋出給附近的人，或「連結」傳給特定朋友。', spot: { top: 370, left: 14, width: 362, height: 130 } },
    { text: '選好後按這裡確認分享，寶石馬上入帳！', spot: { top: 508, left: 14, width: 362, height: 52 } },
  ],
  settings: [
    { text: '這裡是設定頁，可以調整你的帳號與通知偏好。', spot: { top: 104, left: 14, width: 362, height: 126 } },
    { text: '開啟「推播通知」不錯過任何限時優惠券。', spot: { top: 248, left: 14, width: 362, height: 56 } },
    { text: '「隱私模式」開啟後，其他人無法在 CouMap 看到你的位置。', spot: { top: 374, left: 14, width: 362, height: 56 } },
  ],
};

interface OnboardingOverlayProps {
  screenKey: ScreenKey;
  step: number;
  onNext: () => void;
  onDone: () => void;
}

export default function OnboardingOverlay({ screenKey, step, onNext, onDone }: OnboardingOverlayProps) {
  const steps = ONBOARDING[screenKey] ?? [];
  if (!steps.length || step >= steps.length) return null;

  const isLast = step === steps.length - 1;
  const current = steps[step];
  const text = typeof current === 'string' ? current : current.text;
  const spot: SpotConfig | null = typeof current === 'object' && current.spot ? current.spot : null;

  // Position tooltip above spotlight if spot is in bottom half
  const above = spot ? spot.top > SCREEN_H * 0.52 : false;
  const tooltipTop = above
    ? undefined
    : spot
    ? Math.min(spot.top + spot.height + 14, SCREEN_H - 180)
    : 200;
  const tooltipBottom = above && spot ? Math.max(90, SCREEN_H - spot.top + 10) : undefined;

  const handlePress = isLast ? onDone : onNext;

  return (
    <Pressable style={styles.container} onPress={handlePress} testID="onboarding-overlay">
      {/* Dark overlay */}
      <View style={styles.backdrop} pointerEvents="none" />

      {/* Spotlight highlight border */}
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
              borderRadius: spot.radius ?? 8,
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
                  { width: i === step ? 18 : 6, backgroundColor: i <= step ? colors.yellow : 'rgba(255,255,255,0.2)' },
                ]}
              />
            ))}
          </View>
          <Text style={styles.counter}>{step + 1}/{steps.length}</Text>
        </View>

        <Text style={styles.text}>{text}</Text>

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
    fontFamily: 'SpaceGrotesk_800ExtraBold',
    fontSize: 13,
    color: colors.fg,
  },
});
