import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

export interface SpinResult {
  mult: number;
  points: number;
  color: string;
}

interface ResultModalProps {
  result: SpinResult | null;
  onDismiss: () => void;
  canDismiss?: boolean;
}

const TIER_LABELS: Record<number, string> = {
  0: '沒中…下次再試！',
  1: '普通',
  2: '不錯！',
  3: '好運！',
  4: '超棒！',
  5: '大獎！',
};

const TIER_OVERLAY: Record<number, string> = {
  0: 'rgba(0,0,0,0.55)',
  1: 'rgba(0,20,60,0.5)',
  2: 'rgba(0,40,10,0.5)',
  3: 'rgba(80,55,0,0.5)',
  4: 'rgba(100,35,0,0.52)',
  5: 'rgba(40,10,120,0.6)',
};

export default function ResultModal({
  result,
  onDismiss,
  canDismiss = true,
}: ResultModalProps): React.JSX.Element | null {
  const cardScale = useRef(new Animated.Value(0.82)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const multScale = useRef(new Animated.Value(1.5)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (result) {
      const isJackpot = result.mult >= 5;
      cardScale.setValue(isJackpot ? 0.65 : 0.82);
      cardOpacity.setValue(0);
      multScale.setValue(1.5);
      overlayOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(cardScale, {
          toValue: 1,
          tension: isJackpot ? 38 : 58,
          friction: isJackpot ? 5 : 8,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      Animated.spring(multScale, {
        toValue: 1.0,
        tension: 45,
        friction: 7,
        delay: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [result]);

  if (!result) return null;

  const tierLabel = TIER_LABELS[result.mult] ?? '';
  const overlayBg = TIER_OVERLAY[result.mult] ?? 'rgba(0,0,0,0.72)';

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: overlayBg }]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          styles.card,
          { borderColor: result.color, shadowColor: result.color },
          { opacity: cardOpacity, transform: [{ scale: cardScale }] },
        ]}
      >
        <Text style={styles.label}>結果</Text>

        <Animated.Text
          style={[styles.mult, { color: result.color, transform: [{ scale: multScale }] }]}
        >
          ×{result.mult}
        </Animated.Text>

        {result.points > 0 && (
          <View style={styles.pointsRow}>
            <Text style={styles.plus}>+</Text>
            <Text style={styles.points}>{result.points}</Text>
            <Text style={styles.pts}>pts</Text>
          </View>
        )}

        {tierLabel.length > 0 && (
          <Text style={[styles.tierText, result.mult >= 5 && styles.tierTextJackpot]}>
            {tierLabel}
          </Text>
        )}

        {canDismiss && (
          <Pressable
            testID="result-continue-btn"
            onPress={onDismiss}
            style={[styles.continueBtn, { borderColor: colors.border, shadowColor: result.color }]}
          >
            <Text style={styles.continueBtnText}>繼續</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#0F0F0F',
    borderWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 24,
    alignItems: 'center',
    minWidth: 220,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.9,
    shadowRadius: 0,
    elevation: 10,
  },
  label: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  mult: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 56,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  plus: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 24,
    color: '#fff',
    fontWeight: '900',
  },
  points: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 32,
    color: '#fff',
    fontWeight: '900',
  },
  pts: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    alignSelf: 'flex-end',
    paddingBottom: 4,
  },
  tierText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 8,
    fontFamily: fontFamilies.regular,
  },
  tierTextJackpot: {
    color: colors.yellow,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  continueBtn: {
    marginTop: 18,
    paddingHorizontal: 28,
    paddingVertical: 10,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderRadius: 5,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  continueBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '800',
    color: colors.fg,
  },
});
