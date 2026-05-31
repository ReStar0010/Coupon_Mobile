import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Image } from 'expo-image';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { spacing } from '@/src/theme/spacing';
import GemIcon from '@/src/components/icons/GemIcon';
import TicketIcon from '@/src/components/icons/TicketIcon';
import { markLaunchOnboardingSeen } from '@/src/services/onboarding/onboardingState';

const { width: SCREEN_W } = Dimensions.get('window');

// Same asset as the CouPro home-screen top-left logo (the app's adaptive icon).
const APP_LOGO = require('@/assets/adaptive-icon.png');

interface OnboardingPage {
  /** Short hero title in Chinese — matches the consumer-app voice. */
  title: string;
  /** 1-2 line body. */
  body: string;
  /** Hero illustration — built per render so styles are in scope. */
  hero: () => React.JSX.Element;
}

// Pure-data declaration; the hero closures capture `styles` lazily at
// render time, which avoids the temporal-dead-zone pitfall of referring
// to `styles` from a top-level const.
const PAGES: readonly OnboardingPage[] = [
  {
    title: '歡迎使用 CouPro',
    body: '把附近的優惠變成你的優惠券錢包。\n附近店家、附近的人，都在這裡。',
    hero: () => (
      <View style={styles.heroPad}>
        <View style={[styles.heroBox, styles.heroBoxLogo]}>
          <Image
            source={APP_LOGO}
            style={styles.heroLogo}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityLabel="CouPro"
          />
        </View>
      </View>
    ),
  },
  {
    title: '一掃就用',
    body: '挑券、按「立即使用」，店家掃 QR 直接折抵，\n不用排隊、不用截圖。',
    hero: () => (
      <View style={styles.heroPad}>
        <View style={[styles.heroBox, { backgroundColor: colors.yellow }]}>
          <TicketIcon size={64} />
        </View>
      </View>
    ),
  },
  {
    title: '分享賺寶石',
    body: '用不到的優惠券釋出到 CouMap，\n別人領走後你會收到一顆 CouGem。',
    hero: () => (
      <View style={styles.heroPad}>
        <View style={[styles.heroBox, { backgroundColor: colors.purpleLight }]}>
          <GemIcon size={64} color={colors.purple} />
        </View>
      </View>
    ),
  },
];

interface LaunchOnboardingScreenProps {
  onDone: () => void;
}

export default function LaunchOnboardingScreen({
  onDone,
}: LaunchOnboardingScreenProps): React.JSX.Element {
  const [page, setPage] = useState(0);
  const scrollRef = React.useRef<ScrollView>(null);

  const finish = useCallback(async (): Promise<void> => {
    await markLaunchOnboardingSeen();
    onDone();
  }, [onDone]);

  const isLast = page === PAGES.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      void finish();
      return;
    }
    const next = page + 1;
    setPage(next);
    scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
  }, [isLast, page, finish]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Round to the nearest page so finger-flicks settle on a single
    // dot. Without rounding, fast swipes can briefly show `1.4` etc.
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setPage(Math.max(0, Math.min(PAGES.length - 1, idx)));
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topRow}>
        <Pressable
          testID="onboarding-skip-btn"
          onPress={() => void finish()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="跳過介紹"
        >
          <Text style={styles.skipText}>跳過</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {PAGES.map((p, i) => (
          <View key={i} style={[styles.page, { width: SCREEN_W }]} testID={`onboarding-page-${i}`}>
            {p.hero()}
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.body}>{p.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {PAGES.map((_, i) => (
          <View
            key={i}
            testID={`onboarding-dot-${i}`}
            accessibilityRole="image"
            accessibilityState={{ selected: i === page }}
            style={[
              styles.dot,
              {
                width: i === page ? 24 : 8,
                backgroundColor: i === page ? colors.fg : 'rgba(0,0,0,0.18)',
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.ctaWrap}>
        <View style={styles.ctaShadow} />
        <Pressable
          testID="onboarding-next-btn"
          onPress={handleNext}
          style={styles.cta}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>{isLast ? '開始使用 CouPro' : '下一步'}</Text>
        </Pressable>
      </View>

      {/* Bottom hero icon — pure decoration; the simple shape keeps the
          page calm so the body copy reads cleanly. */}
      <View style={styles.cornerOrnament} pointerEvents="none">
        <Svg width={48} height={48} viewBox="0 0 24 24">
          <Rect
            x={2}
            y={2}
            width={20}
            height={20}
            rx={3}
            fill="none"
            stroke={colors.border}
            strokeWidth={2}
          />
          <Path d="M2 12 L22 12 M12 2 L12 22" stroke={colors.border} strokeWidth={1.5} />
          <Circle cx={12} cy={12} r={3} fill={colors.yellow} stroke={colors.border} strokeWidth={2} />
        </Svg>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  skipText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: colors.muted,
  },
  page: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.lg,
  },
  heroPad: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  heroBox: {
    width: 160,
    height: 160,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.border,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  // Page 1 shows the adaptive-icon image filling the box, so clip it to the
  // rounded frame (matches the home-screen top-left logo treatment).
  heroBoxLogo: {
    overflow: 'hidden',
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 28,
    letterSpacing: -0.8,
    color: colors.fg,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.lg,
  },
  dot: { height: 8, borderRadius: 4 },
  ctaWrap: {
    position: 'relative',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  ctaShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  cta: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    color: colors.fg,
    letterSpacing: -0.2,
  },
  cornerOrnament: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    opacity: 0.18,
  },
});
