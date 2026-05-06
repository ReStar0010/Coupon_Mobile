import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
}

export default function ResultModal({ result, onDismiss }: ResultModalProps): React.JSX.Element | null {
  if (!result) return null;

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { borderColor: result.color }]}>
        <Text style={styles.label}>結果</Text>
        <Text style={[styles.mult, { color: result.color }]}>
          ×{result.mult}
        </Text>
        <View style={styles.pointsRow}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.points}>{result.points}</Text>
          <Text style={styles.pts}>pts</Text>
        </View>
        {result.mult === 0 && (
          <Text style={styles.missText}>這次沒有…下次再試！</Text>
        )}
        {result.mult === 5 && (
          <Text style={styles.jackpotText}>大獎！</Text>
        )}
        <Pressable
          testID="result-continue-btn"
          onPress={onDismiss}
          style={[styles.continueBtn, { shadowColor: colors.border }]}
        >
          <Text style={styles.continueBtnText}>繼續</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
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
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
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
  missText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 8,
    fontFamily: fontFamilies.regular,
  },
  jackpotText: {
    fontSize: 13,
    color: colors.yellow,
    marginTop: 8,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
  },
  continueBtn: {
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 10,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
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
