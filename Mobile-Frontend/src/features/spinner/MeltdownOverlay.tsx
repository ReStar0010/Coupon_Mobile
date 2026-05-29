import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import MeltdownWheel from './MeltdownWheel';
import type { SpinResult } from './ResultModal';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

interface MeltdownOverlayProps {
  active: boolean;
  meltdownResult: SpinResult | null;
  meltdownSpin: number;
  meltdownSpinning: boolean;
  originalResult: SpinResult | null;
  onDismiss: () => void;
}

export default function MeltdownOverlay({
  active,
  meltdownResult,
  meltdownSpin,
  meltdownSpinning,
  originalResult,
  onDismiss,
}: MeltdownOverlayProps): React.JSX.Element | null {
  const slideY = useSharedValue(500);
  const bgOp = useSharedValue(0);
  const titlePulse = useSharedValue(1);

  useEffect(() => {
    if (active) {
      bgOp.value = withTiming(1, { duration: 300 });
      slideY.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.back(1.4)) });
      titlePulse.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 380, easing: Easing.out(Easing.sin) }),
          withTiming(1.0, { duration: 380, easing: Easing.in(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      bgOp.value = withTiming(0, { duration: 200 });
      slideY.value = withTiming(500, { duration: 300 });
    }
  }, [active]);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOp.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titlePulse.value }],
  }));

  if (!active) return null;

  const finalPts = meltdownResult?.points ?? 0;
  const meltMult = meltdownResult?.mult ?? '?';

  return (
    <Reanimated.View style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="box-none">
      <Reanimated.View style={[StyleSheet.absoluteFill, styles.bg, bgStyle]} pointerEvents="none" />
      <Reanimated.View style={[styles.card, cardStyle]}>
        <Reanimated.Text style={[styles.title, titleStyle]}>🔥 MELTDOWN</Reanimated.Text>

        <View style={styles.wheelContainer}>
          <MeltdownWheel size={180} spin={meltdownSpin} spinning={meltdownSpinning} />
        </View>

        {meltdownResult ? (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>倍率追加</Text>
            <Text style={[styles.resultMult, { color: meltdownResult.color }]}>×{meltMult}</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>最終總計</Text>
              <Text style={styles.totalPts}>{finalPts} pts</Text>
            </View>
            {originalResult && (
              <Text style={styles.calcText}>
                {originalResult.points} × {meltMult} = {finalPts}
              </Text>
            )}
            <Pressable
              style={[
                styles.dismissBtn,
                { borderColor: meltdownResult.color, shadowColor: meltdownResult.color },
              ]}
              onPress={onDismiss}
            >
              <Text style={styles.dismissBtnText}>繼續</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.spinningText}>計算中…</Text>
        )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    zIndex: 200,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  bg: {
    backgroundColor: 'rgba(8,0,24,0.82)',
  },
  card: {
    backgroundColor: '#0D0D18',
    borderWidth: 3,
    borderColor: colors.purple,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 22,
    alignItems: 'center',
    width: 300,
    shadowColor: colors.purple,
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.9,
    shadowRadius: 0,
    elevation: 20,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: colors.purple,
    letterSpacing: 2,
    marginBottom: 14,
  },
  wheelContainer: {
    marginBottom: 14,
  },
  resultSection: {
    alignItems: 'center',
    width: '100%',
  },
  resultLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
  },
  resultMult: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '900',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  totalPts: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    color: '#fff',
  },
  calcText: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
  },
  dismissBtn: {
    marginTop: 18,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderRadius: 5,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  dismissBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '800',
    color: colors.fg,
  },
  spinningText: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 12,
    letterSpacing: 1,
  },
});
