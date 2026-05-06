import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AppStatusBar from '../../components/chrome/StatusBar';
import TabBar from '../../components/chrome/TabBar';
import GemPips from '../../components/ui/GemPips';
import Stepper from '../../components/ui/Stepper';
import AnimNum from '../../components/ui/AnimNum';
import GemIcon from '../../components/icons/GemIcon';
import WheelDial from './WheelDial';
import ResultModal from './ResultModal';
import { useSpinLogic } from './useSpinLogic';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

interface SpinnerScreenProps {
  onNavigate: (screen: string) => void;
  gems: number;
  setGems: (fn: (prev: number) => number) => void;
  couPoints: number;
  setCouPoints: (fn: (prev: number) => number) => void;
}

export default function SpinnerScreen({
  onNavigate,
  gems,
  setGems,
  couPoints,
  setCouPoints,
}: SpinnerScreenProps): React.JSX.Element {
  const [players, setPlayers] = useState(1);
  const [filledGuests, setFilledGuests] = useState(0);

  const invited = players - 1;
  const allFilled = filledGuests >= invited;

  useEffect(() => { setFilledGuests(0); }, [players]);

  const { spin, spinning, result, floor, handleSpin, dismissResult } = useSpinLogic({
    gems,
    setGems,
    setCouPoints,
    players,
    allFilled,
  });

  const canSpin = !spinning && allFilled && gems >= 1;

  const slotType = (i: number) => {
    if (i === 0) return 'me';
    if (i <= filledGuests) return 'guest';
    return 'empty';
  };

  const handleTabPress = (tab: string) => onNavigate(tab);

  return (
    <View style={styles.screen}>
      <AppStatusBar />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>抽獎桌</Text>
        <View style={styles.badges}>
          <View testID="coupoints-badge" style={styles.badge}>
            <AnimNum value={couPoints} color={colors.fg} fontSize={14} />
          </View>
          <View testID="gems-badge" style={styles.badge}>
            <GemIcon size={14} color={colors.purple} />
            <AnimNum value={gems} color={colors.fg} fontSize={14} />
          </View>
        </View>
      </View>

      {/* Wheel area */}
      <View style={styles.wheelArea}>
        {/* Player slots */}
        <View style={styles.slots}>
          {Array.from({ length: players }).map((_, i) => {
            const slot = slotType(i);
            return (
              <Pressable
                key={i}
                testID="player-slot"
                onPress={() => { if (slot === 'empty') setFilledGuests((g) => g + 1); }}
                style={[
                  styles.slot,
                  slot === 'me' && styles.slotMe,
                  slot === 'guest' && styles.slotGuest,
                  slot === 'empty' && styles.slotEmpty,
                ]}
              >
                <Text style={styles.slotText}>
                  {slot === 'me' ? '我' : slot === 'guest' ? '友' : '+'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Wheel */}
        <View style={styles.wheelWrapper}>
          <WheelDial size={260} floor={floor} spin={spin} spinning={spinning} gems={gems} />
        </View>
      </View>

      {/* Controls panel */}
      <View style={styles.controls}>
        <View testID="gem-pips-container">
          <GemPips count={5} filled={gems} />
        </View>
        <View style={styles.steppers}>
          <Stepper label="寶石" value={gems} min={1} max={5} onChange={(v) => setGems(() => v)} accent />
          <View style={styles.divider} />
          <Stepper label="揪友" value={players} min={1} max={3} onChange={setPlayers} />
        </View>
        <Pressable
          testID="spin-button"
          onPress={handleSpin}
          disabled={!canSpin}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSpin }}
          style={[styles.spinBtn, canSpin ? styles.spinBtnActive : styles.spinBtnDisabled]}
        >
          <Text style={[styles.spinBtnText, !canSpin && styles.spinBtnTextDisabled]}>
            {!allFilled ? '等待朋友加入' : spinning ? '轉啊轉…' : 'SPIN!'}
          </Text>
        </Pressable>
        <Text style={styles.hint}>消耗 {gems} 顆寶石 · 結果 = 寶石 × 倍率</Text>
      </View>

      <ResultModal result={result} onDismiss={dismissResult} />
      <TabBar activeTab="spinner" onTabPress={handleTabPress} dark />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
  },
  wheelArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 200,
  },
  slots: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  slot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotMe: { backgroundColor: colors.purple },
  slotGuest: { backgroundColor: colors.green },
  slotEmpty: { backgroundColor: '#FFFFFF' },
  slotText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.fg,
  },
  wheelWrapper: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    zIndex: 3,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#111',
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  steppers: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    borderLeftWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderStyle: 'dashed',
  },
  spinBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 6,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinBtnActive: {
    backgroundColor: colors.yellow,
    borderColor: colors.border,
    shadowOffset: { width: 6, height: 6 },
    shadowColor: colors.border,
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  spinBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  spinBtnText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.fg,
  },
  spinBtnTextDisabled: {
    color: 'rgba(255,255,255,0.25)',
  },
  hint: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 5,
  },
});
