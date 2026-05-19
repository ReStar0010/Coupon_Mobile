/**
 * Reveal animation choreography.
 *
 * Drives a three-phase reveal off `coop.state.reveal.plan`:
 *
 *   total   → big payout banner counts up 0 → total_payout
 *   floor   → per-seat horizontal bars fill to (floor / total) deterministically
 *   excess  → per-seat numbers count up to excess_i (the random "spinner" portion)
 *
 * All values come from the authoritative `room.reveal` payload. This component
 * is pure presentation — it never decides outcomes.
 *
 * Tap anywhere on the surface to skip; that immediately sends `reveal.ack` and
 * fast-forwards the local visualization. The server settles on receipt.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../theme/colors';
import { fontFamilies } from '../../../theme/typography';
import type { RevealPlanPhase, ShareSnapshot } from './coopProtocol';
import { getRevealCue, RevealCue, visibleValue } from './reveal';

interface RevealAnimationProps {
  roundId: string;
  M: number;
  totalPayout: number;
  shares: ShareSnapshot[];
  plan: { phases: RevealPlanPhase[] };
  /** Highlights the row matching this user_id. */
  meUserId: string;
  /** Called when the user taps to skip OR the timeline finishes naturally. */
  onAck: (roundId: string) => void;
}

const TICK_MS = 33; // ~30Hz, smooth enough for count-up + bar fill

export default function RevealAnimation({
  roundId,
  M,
  totalPayout,
  shares,
  plan,
  meUserId,
  onAck,
}: RevealAnimationProps): React.JSX.Element {
  const startedAtRef = useRef<number>(Date.now());
  const ackedRef = useRef(false);
  const [cue, setCue] = useState<RevealCue>(() => getRevealCue(0, plan.phases));

  // Reset when round changes
  useEffect(() => {
    startedAtRef.current = Date.now();
    ackedRef.current = false;
    setCue(getRevealCue(0, plan.phases));
  }, [roundId, plan.phases]);

  // Local 30Hz tick to drive the timeline
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const next = getRevealCue(elapsed, plan.phases);
      setCue(next);
      if (next.phase === 'done' && !ackedRef.current) {
        ackedRef.current = true;
        onAck(roundId);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [plan.phases, roundId, onAck]);

  const skip = () => {
    if (ackedRef.current) return;
    ackedRef.current = true;
    setCue({
      phase: 'done',
      phaseProgress: 1,
      completed: new Set(['total', 'floor', 'excess']),
      elapsedMs: cue.totalMs,
      totalMs: cue.totalMs,
    });
    onAck(roundId);
  };

  const totalShown = Math.round(visibleValue(cue, 'total', totalPayout));

  return (
    <Pressable testID="reveal-skip" onPress={skip} style={styles.surface}>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>本次總獎金</Text>
        <Text testID="reveal-total" style={styles.totalValue}>
          {totalShown}
          <Text style={styles.totalUnit}> CouPoints</Text>
        </Text>
        <Text style={styles.metaText}>×{M} 倍率</Text>
      </View>

      {shares.map((s) => (
        <ShareRow
          key={s.user_id}
          share={s}
          totalPayout={totalPayout}
          cue={cue}
          isMe={s.user_id === meUserId}
        />
      ))}

      {cue.phase !== 'done' && <Text style={styles.skipHint}>按一下跳過 · 自動結算中…</Text>}
    </Pressable>
  );
}

interface ShareRowProps {
  share: ShareSnapshot;
  totalPayout: number;
  cue: RevealCue;
  isMe: boolean;
}

function ShareRow({ share, totalPayout, cue, isMe }: ShareRowProps): React.JSX.Element {
  // Floor bar width as % of the total payout (so per-seat bars compose visually
  // to fill the row in proportion to each player's contribution).
  const floorPct = totalPayout > 0 ? (share.floor / totalPayout) * 100 : 0;
  const visibleFloorPct = (visibleValue(cue, 'floor', floorPct) / 100) * 100;
  const visibleExcess = Math.round(visibleValue(cue, 'excess', share.excess));
  const grandTotal = Math.round(visibleValue(cue, 'floor', share.floor)) + visibleExcess;

  return (
    <View
      testID={`share-row-${share.user_id}`}
      style={[styles.shareRow, isMe && styles.shareRowMe]}
    >
      <View style={styles.shareHeader}>
        <Text style={styles.shareName}>
          Seat {share.seat}
          {isMe ? ' (你)' : ''}
        </Text>
        <Text style={styles.shareValue}>
          {grandTotal}
          <Text style={styles.shareBreakdown}>
            {' '}
            ({share.floor}+{share.excess})
          </Text>
        </Text>
      </View>
      <View style={styles.bar}>
        <View
          testID={`floor-fill-${share.user_id}`}
          style={[
            styles.barFill,
            {
              width: `${Math.min(100, visibleFloorPct)}%` as `${number}%`,
              backgroundColor: colors.yellow,
            },
          ]}
        />
      </View>
      {(cue.phase === 'excess' || cue.phase === 'done') && share.excess > 0 && (
        <Text testID={`excess-${share.user_id}`} style={styles.excessText}>
          + {visibleExcess} 額外
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { gap: 10 },
  totalCard: {
    backgroundColor: '#2A2A2A',
    borderWidth: 2.5,
    borderColor: colors.yellow,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 6,
  },
  totalLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  totalValue: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 36,
    color: colors.yellow,
  },
  totalUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
  metaText: { fontFamily: fontFamilies.monoSemiBold, fontSize: 12, color: '#F5F5F0' },

  shareRow: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
    padding: 10,
    gap: 6,
  },
  shareRowMe: { borderColor: colors.yellow },
  shareHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  shareName: { fontFamily: fontFamilies.bold, fontSize: 13, color: '#fff' },
  shareValue: { fontFamily: fontFamilies.extraBold, fontSize: 18, color: colors.yellow },
  shareBreakdown: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  bar: {
    height: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  barFill: { height: '100%' },
  excessText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 12,
    color: colors.purpleLight,
  },
  skipHint: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 6,
  },
});
