/**
 * Lucky Rain reveal animation for co-op spinner results.
 *
 * Shows the total pool, then animated coins rain down into player avatars.
 * Each coin landing has a sparkle effect. The viewer's own result pulses
 * big at the end. Communicates the random-split mechanism transparently.
 *
 * Uses React Native Animated API for the coin drop choreography.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { colors } from '../../../theme/colors';
import { fontFamilies } from '../../../theme/typography';

export interface PlayerResult {
  userId: string;
  seat: number;
  displayName: string;
  points: number;
  isMe: boolean;
}

interface CoinRainRevealProps {
  multiplier: number;
  totalPool: number;
  players: PlayerResult[];
  onDone: () => void;
}

const COIN_DROP_INTERVAL_MS = 120;
const MAX_ANIMATED_COINS = 80;

export default function CoinRainReveal({
  multiplier,
  totalPool,
  players,
  onDone,
}: CoinRainRevealProps): React.JSX.Element {
  const [visiblePoints, setVisiblePoints] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of players) init[p.userId] = 0;
    return init;
  });
  const [phase, setPhase] = useState<'pool' | 'rain' | 'done'>('pool');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const playersKey = useMemo(() => players.map((p) => p.userId).join(','), [players]);
  const poolScale = useRef(new Animated.Value(0.5)).current;
  const poolOpacity = useRef(new Animated.Value(0)).current;
  const myResultScale = useRef(new Animated.Value(1)).current;
  const peerScales = useRef(players.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(poolScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(poolOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => setPhase('rain'), 600);
    });
  }, []);

  useEffect(() => {
    if (phase !== 'rain') return;

    const allCoins: { userId: string }[] = [];
    for (const p of players) {
      for (let i = 0; i < Math.min(p.points, MAX_ANIMATED_COINS); i++) {
        allCoins.push({ userId: p.userId });
      }
    }
    for (let i = allCoins.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCoins[i], allCoins[j]] = [allCoins[j], allCoins[i]];
    }

    let idx = 0;
    const timer = setInterval(() => {
      if (idx >= allCoins.length) {
        clearInterval(timer);
        setPhase('done');
        const me = players.find((p) => p.isMe);
        if (me) {
          setHighlightId(me.userId);
          Animated.sequence([
            Animated.timing(myResultScale, { toValue: 1.25, duration: 200, useNativeDriver: true }),
            Animated.spring(myResultScale, { toValue: 1.0, tension: 80, friction: 6, useNativeDriver: true }),
          ]).start();
        }
        return;
      }
      const coin = allCoins[idx];
      setVisiblePoints((prev) => ({
        ...prev,
        [coin.userId]: (prev[coin.userId] ?? 0) + 1,
      }));
      setHighlightId(coin.userId);
      idx++;
    }, COIN_DROP_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [phase, playersKey]);

  const me = players.find((p) => p.isMe);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.poolCard, { transform: [{ scale: poolScale }], opacity: poolOpacity }]}>
        <Text style={styles.poolLabel}>總獎池</Text>
        <Text style={styles.poolValue}>{totalPool}</Text>
        <Text style={styles.poolUnit}>CouPoints</Text>
        <Text style={styles.poolMeta}>×{multiplier} 倍率 · 隨機分配</Text>
      </Animated.View>

      <View style={styles.avatarRow}>
        {players.map((p, index) => {
          const isHighlighted = highlightId === p.userId;
          const scale = p.isMe && phase === 'done' ? myResultScale : peerScales[index];
          return (
            <Animated.View key={p.userId} style={[styles.avatarCol, { transform: [{ scale }] }]}>
              <View style={[
                styles.avatar,
                p.isMe ? styles.avatarMe : styles.avatarPeer,
                isHighlighted && phase === 'rain' && styles.avatarHighlight,
              ]}>
                <Text style={styles.avatarText}>{p.isMe ? '我' : p.seat}</Text>
              </View>
              <Text style={[styles.pointsText, p.isMe && styles.pointsTextMe]}>
                {visiblePoints[p.userId] ?? 0}
              </Text>
              {phase === 'done' && (
                <Text style={styles.nameText}>{p.displayName}</Text>
              )}
            </Animated.View>
          );
        })}
      </View>

      {phase === 'done' && me && (
        <View style={styles.myResultCard}>
          <Text style={styles.myResultLabel}>你獲得</Text>
          <Text style={styles.myResultValue}>{me.points}</Text>
          <Text style={styles.myResultUnit}>CouPoints</Text>
        </View>
      )}

      {phase === 'done' && (
        <Pressable style={styles.doneBtn} onPress={onDone} testID="rain-done-btn">
          <Text style={styles.doneBtnText}>再玩一局</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  poolCard: {
    backgroundColor: '#2A2A2A',
    borderWidth: 2.5,
    borderColor: colors.yellow,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.yellow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
  },
  poolLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  poolValue: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 42,
    color: colors.yellow,
    letterSpacing: -1.5,
  },
  poolUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  poolMeta: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 6,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 24,
    justifyContent: 'center',
    marginVertical: 8,
  },
  avatarCol: {
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: { backgroundColor: colors.purple },
  avatarPeer: { backgroundColor: colors.green },
  avatarHighlight: {
    borderColor: colors.yellow,
    shadowColor: colors.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  avatarText: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#fff',
  },
  pointsText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: '#fff',
  },
  pointsTextMe: {
    color: colors.yellow,
  },
  nameText: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  myResultCard: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: colors.border,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  myResultLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.fg,
  },
  myResultValue: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 36,
    color: colors.fg,
    letterSpacing: -1,
  },
  myResultUnit: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    color: 'rgba(51,51,51,0.6)',
  },
  doneBtn: {
    backgroundColor: colors.fg,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 28,
    paddingVertical: 12,
    shadowColor: colors.border,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  doneBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#fff',
  },
});
