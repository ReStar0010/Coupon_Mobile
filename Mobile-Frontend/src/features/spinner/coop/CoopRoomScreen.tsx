import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../../theme/colors';
import { fontFamilies } from '../../../theme/typography';
import type { UseCoopRoomResult } from './useCoopRoom';
import type { PlayerSnapshot } from './coopProtocol';
import ChargeMeter from './ChargeMeter';
import { allFullyCharged, interpolateLocalCharge } from './charge';
import ResultModal from '../ResultModal';
import type { SpinResult } from '../ResultModal';
import { MULTS } from '../constants';
import { useForceUpdate } from './useForceUpdate';

interface CoopRoomScreenProps {
  coop: UseCoopRoomResult & { active: boolean; activate: () => void; deactivate: () => void };
  gems: number;
  onExit: () => void;
  onStartStaking?: () => void;
}

const ERROR_AUTO_DISMISS_MS = 4_000;

export default function CoopRoomScreen({ coop, gems, onExit, onStartStaking }: CoopRoomScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { state, status, clearError } = coop;

  // v2 H-5: auto-dismiss the error banner so stale codes don't haunt the UI.
  useEffect(() => {
    if (!state.lastError) return;
    const id = setTimeout(clearError, ERROR_AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [state.lastError, clearError]);

  // Auto-navigate ALL players to SpinnerScreen once the game leaves lobby.
  // The host triggers staking via "開始下注", but guests receive the phase
  // change over WS — this effect ensures everyone lands on the same screen.
  const postLobby = state.phase !== null
    && state.phase !== 'SOLO'
    && state.phase !== 'LOBBY_OPEN';
  useEffect(() => {
    if (postLobby) onStartStaking?.();
  }, [postLobby]);

  const meUserId = state.meUserId ?? '';

  // Reveal result for the top-level ResultModal overlay
  const reveal = state.phase === 'REVEAL' ? state.reveal : null;
  const [revealDismissed, setRevealDismissed] = useState(false);
  const prevRoundId = useRef<string | null>(null);

  useEffect(() => {
    if (reveal && reveal.roundId !== prevRoundId.current) {
      prevRoundId.current = reveal.roundId;
      setRevealDismissed(false);
    }
  }, [reveal]);

  const myShare = reveal?.shares.find((s) => s.user_id === meUserId);
  const myPoints = myShare ? myShare.floor + myShare.excess : 0;
  const revealResult: SpinResult | null =
    reveal && !revealDismissed
      ? { mult: reveal.M, points: myPoints, color: multColor(reveal.M) }
      : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable testID="coop-exit" onPress={onExit} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>多人轉盤</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      {state.lastError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            ⚠ {state.lastError.code}: {state.lastError.message}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <PhaseView coop={coop} userId={meUserId} gems={gems} onStartStaking={onStartStaking} />
      </ScrollView>

      <ResultModal
        result={revealResult}
        onDismiss={() => {
          setRevealDismissed(true);
          if (reveal) coop.ackReveal(reveal.roundId);
        }}
      />
    </View>
  );
}

interface PhaseViewProps {
  coop: UseCoopRoomResult;
  userId: string;
  gems: number;
  onStartStaking?: () => void;
}

function PhaseView({ coop, userId, gems, onStartStaking }: PhaseViewProps): React.JSX.Element {
  const { state } = coop;
  if (state.phase === null) {
    return <ConnectView coop={coop} />;
  }
  switch (state.phase) {
    case 'SOLO':
    case 'LOBBY_OPEN':
      return <LobbyView coop={coop} onStartStaking={onStartStaking} />;
    case 'STAKING':
      return <StakingView coop={coop} userId={userId} gems={gems} />;
    case 'READY':
      return <ReadyView coop={coop} userId={userId} />;
    case 'COUNTDOWN':
      return <CountdownView coop={coop} />;
    case 'CHARGING':
      return <ChargingView coop={coop} userId={userId} />;
    case 'SPINNING':
      return <SpinningView />;
    case 'REVEAL':
      return <RevealView coop={coop} userId={userId} />;
    case 'SETTLED':
      return <SettledView coop={coop} userId={userId} />;
    case 'ABORTED':
      return <AbortedView coop={coop} />;
    default:
      return <Text style={styles.bodyText}>跳轉到轉盤中…</Text>;
  }
}

// ── Per-phase sub-views ─────────────────────────────────────────────────────

function ConnectView({ coop }: { coop: UseCoopRoomResult }) {
  const [code, setCode] = useState('');
  const isConnected = coop.status === 'open';
  // Show the Retry affordance when we're definitively closed (handshake
  // failed or transport dropped). 'connecting' still has hope, so we
  // disable the buttons but don't show Retry yet — it would race with
  // the in-flight handshake.
  const showRetry = coop.status === 'closed';
  return (
    <View testID="phase-connect">
      <Text style={styles.h2}>建立或加入房間</Text>
      {!isConnected && (
        <Text style={styles.bodyText}>
          {coop.status === 'connecting' ? '連線中…' : '連線已中斷'}
        </Text>
      )}
      <View style={styles.btnGroup}>
        <PrimaryBtn
          label="開多人房"
          onPress={() => coop.createRoom(false)}
          disabled={!isConnected}
          testID="btn-multi"
        />
        {showRetry && (
          <PrimaryBtn
            label="重新連線"
            onPress={() => coop.reconnect()}
            // Defensive: in the brief gap between tap-onPress and the next
            // re-render (where status flips to 'connecting' and this branch
            // unmounts), a fast double-tap could otherwise fire reconnect()
            // twice. The CoopClient also guards CONNECTING in connect(),
            // so this is belt-and-suspenders.
            disabled={coop.status !== 'closed'}
            testID="btn-retry-connection"
          />
        )}
      </View>
      <Text style={styles.label}>用代碼加入</Text>
      <View style={styles.row}>
        <TextInput
          testID="join-code"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="ABCDEF"
          placeholderTextColor={colors.muted}
          maxLength={6}
          style={styles.input}
        />
        <PrimaryBtn
          label="加入"
          onPress={() => coop.joinRoom({ code })}
          disabled={!isConnected || code.length < 4}
          testID="btn-join"
        />
      </View>
    </View>
  );
}

function LobbyView({ coop, onStartStaking }: { coop: UseCoopRoomResult; onStartStaking?: () => void }) {
  const { state } = coop;
  // The QR encodes a coupro:// deep link carrying the room code. Note: a
  // matching deep-link handler route is not yet wired up (no entry in
  // app.json intentFilters for spinner-coop-join, no route file). For the
  // moment the QR functions as a shareable visual representation of the
  // 6-char code shown beneath it — a friend across the table can read
  // either form and type the code into ConnectView's input. The deep-link
  // shape is preserved so a future change can route the scanning device
  // directly into the join flow without forcing a re-encoding rollout.
  const inviteUrl = state.code ? `coupro://spinner-coop-join?code=${state.code}` : '';
  return (
    <View testID="phase-lobby">
      <Text style={styles.h2}>等待玩家加入</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>房間代碼</Text>
        {state.code && (
          <View style={styles.qrWrapper}>
            <QRCode value={inviteUrl} size={168} backgroundColor="#fff" />
          </View>
        )}
        <Text testID="room-code" style={styles.codeValue}>
          {state.code}
        </Text>
        <Text style={styles.codeHint}>請朋友掃描 QR 或輸入代碼加入</Text>
      </View>
      <PlayerRoster players={state.players} hostId={state.hostId} />
      <PrimaryBtn
        label="開始下注"
        onPress={() => {
          coop.setStake(1);
          onStartStaking?.();
        }}
        testID="btn-begin-staking"
      />
    </View>
  );
}

function StakingView({ coop, userId, gems }: { coop: UseCoopRoomResult; userId: string; gems: number }) {
  const { state } = coop;
  const me = state.players.find((p) => p.user_id === userId);
  const stake = me?.stake ?? 1;
  const locked = me?.locked ?? false;
  const maxStake = Math.max(1, Math.min(5, gems));
  return (
    <View testID="phase-staking">
      <Text style={styles.h2}>選擇寶石數量</Text>
      {gems < 1 && (
        <Text style={styles.insufficientText}>寶石不足，無法下注</Text>
      )}
      <View style={styles.row}>
        <SmallBtn
          label="−"
          onPress={() => coop.setStake(Math.max(1, stake - 1))}
          disabled={locked || stake <= 1}
        />
        <Text testID="stake-value" style={styles.bigNum}>
          {stake}
        </Text>
        <SmallBtn
          label="+"
          onPress={() => coop.setStake(Math.min(maxStake, stake + 1))}
          disabled={locked || stake >= maxStake}
        />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>合計：{state.gemsTotal} 寶石</Text>
        <Text style={styles.metaText}>底倍：×{state.floorPreview}</Text>
      </View>
      <PrimaryBtn
        label={locked ? '取消鎖定' : '確認鎖定'}
        onPress={() => (locked ? coop.unlockStake() : coop.lockStake())}
        disabled={!locked && gems < 1}
        testID="btn-lock"
      />
      <PlayerRoster players={state.players} hostId={state.hostId} highlight={(p) => p.locked} />
    </View>
  );
}

function ReadyView({ coop, userId }: { coop: UseCoopRoomResult; userId: string }) {
  const { state } = coop;
  const isHost = state.hostId === userId;
  return (
    <View testID="phase-ready">
      <Text style={styles.h2}>準備開始</Text>
      <Text style={styles.bodyText}>
        合計 {state.gemsTotal} 寶石 · 底倍 ×{state.floor} · 共 {state.players.length} 人
      </Text>
      {isHost ? (
        <PrimaryBtn
          label="開始倒數"
          onPress={() => coop.startCountdown()}
          testID="btn-start-countdown"
        />
      ) : (
        <Text style={styles.bodyText}>等待房主開始…</Text>
      )}
    </View>
  );
}

function CountdownView({ coop }: { coop: UseCoopRoomResult }) {
  const { countdownStartedAt, countdownDurationMs } = coop.state;
  const [tick, setTick] = useState(coop.state.countdownTick ?? 3);

  useEffect(() => {
    if (countdownStartedAt == null) return;
    const update = () => {
      const elapsed = Date.now() - countdownStartedAt;
      const remaining = Math.max(0, countdownDurationMs - elapsed);
      setTick(Math.max(1, Math.ceil(remaining / 1000)) as 1 | 2 | 3);
    };
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [countdownStartedAt, countdownDurationMs]);

  return (
    <View testID="phase-countdown" style={styles.center}>
      <Text style={styles.giant}>{tick}</Text>
      <Text style={styles.bodyText}>準備按住</Text>
    </View>
  );
}

function ChargingView({
  coop,
  userId,
}: {
  coop: UseCoopRoomResult;
  userId: string;
}): React.JSX.Element {
  const me = coop.state.players.find((p) => p.user_id === userId);
  const peers = coop.state.players.filter((p) => p.user_id !== userId);
  const serverProgress = me?.progress ?? 0;
  const isCharging = !!me?.is_charging;
  const everyoneCharged = allFullyCharged(coop.state.players.map((p) => p.progress));

  const fillAnim = useSharedValue(serverProgress);
  const [displayPercent, setDisplayPercent] = useState(Math.round(serverProgress * 100));

  useEffect(() => {
    const target = Math.min(1, serverProgress);
    fillAnim.value = withTiming(target, {
      duration: isCharging ? 100 : 200,
      easing: Easing.out(Easing.quad),
    });
    setDisplayPercent(Math.round(target * 100));
  }, [serverProgress, isCharging, fillAnim]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillAnim.value * 100}%`,
  }));

  return (
    <View testID="phase-charging">
      <Text style={styles.h2}>長按開始</Text>
      <Pressable
        testID="charge-btn"
        onPressIn={() => coop.pressIn()}
        onPressOut={() => coop.pressOut()}
        style={styles.chargeBtn}
      >
        <Reanimated.View
          pointerEvents="none"
          style={[styles.chargeFill, fillStyle]}
        />
        <Text style={styles.chargeBtnText}>{displayPercent}%</Text>
      </Pressable>
      {everyoneCharged && (
        <Text testID="all-charged-cue" style={styles.allChargedCue}>
          ⚡ 全員蓄滿！
        </Text>
      )}
      <Text style={styles.label}>其他玩家進度</Text>
      {peers.map((p) => (
        <PeerCharge key={p.user_id} player={p} />
      ))}
    </View>
  );
}

/**
 * Owns the local-charge interpolation contract:
 *   - tracks the press epoch in a ref (no rerenders for state changes)
 *   - ticks at ~30Hz only WHILE charging so we don't burn frames idle
 *   - returns the dead-reckoned [0..1] progress the caller renders
 *
 * Extracted per the frontend-patterns skill (custom hook over inline
 * useState+useRef bloat in the consuming component).
 */
function useLocalChargeProgress(args: {
  isCharging: boolean;
  serverProgress: number;
  durationMs: number;
}): number {
  const { isCharging, serverProgress, durationMs } = args;
  const pressedAtRef = useRef<number | null>(null);
  const tick = useForceUpdate();

  useEffect(() => {
    if (isCharging && pressedAtRef.current === null) {
      pressedAtRef.current = Date.now();
    } else if (!isCharging) {
      pressedAtRef.current = null;
    }
  }, [isCharging]);

  useEffect(() => {
    if (!isCharging) return;
    const id = setInterval(tick, 33);
    return () => clearInterval(id);
  }, [isCharging, tick]);

  return interpolateLocalCharge({
    serverProgress,
    isCharging,
    pressedAtMs: pressedAtRef.current,
    nowMs: Date.now(),
    durationMs,
  });
}

function SpinningView() {
  return (
    <View testID="phase-spinning" style={styles.center}>
      <ActivityIndicator size="large" color={colors.yellow} />
      <Text style={styles.bodyText}>轉盤旋轉中…</Text>
    </View>
  );
}

function multColor(m: number): string {
  return MULTS.find((x) => x.v === m)?.color ?? MULTS[0].color;
}

function RevealView({ coop, userId }: { coop: UseCoopRoomResult; userId: string }) {
  const reveal = coop.state.reveal;
  if (!reveal) return <Text style={styles.bodyText}>等待結果…</Text>;

  return (
    <View testID="phase-reveal">
      <Text style={styles.h2}>個人分配</Text>
      <Text style={styles.bodyText}>×{reveal.M} 倍率 · 共 {reveal.totalPayout} CouPoints</Text>
      {reveal.shares.map((s) => (
        <View
          key={s.user_id}
          style={[styles.breakdownRow, s.user_id === userId && styles.breakdownRowMe]}
        >
          <Text style={styles.breakdownSeat}>
            Seat {s.seat}{s.user_id === userId ? ' (你)' : ''}
          </Text>
          <Text style={styles.breakdownPts}>
            {s.floor + s.excess} pts
          </Text>
        </View>
      ))}
    </View>
  );
}

function SettledView({ coop, userId }: { coop: UseCoopRoomResult; userId: string }) {
  const myCredit = coop.state.credited?.[userId] ?? 0;
  return (
    <View testID="phase-settled">
      <Text style={styles.h2}>已結算</Text>
      <Text style={styles.bodyText}>你獲得 {myCredit} CouPoints</Text>
      <PrimaryBtn label="再玩一局" onPress={() => coop.requestRematch()} testID="btn-rematch" />
    </View>
  );
}

function AbortedView({ coop }: { coop: UseCoopRoomResult }) {
  return (
    <View testID="phase-aborted">
      <Text style={styles.h2}>本局取消</Text>
      <Text style={styles.bodyText}>原因：{coop.state.abortReason ?? '未知'}（已退還寶石）</Text>
    </View>
  );
}

// ── Building blocks ─────────────────────────────────────────────────────────

function PrimaryBtn({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
    >
      <Text style={[styles.primaryBtnText, disabled && styles.primaryBtnTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SmallBtn({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.smallBtn, disabled && styles.primaryBtnDisabled]}
    >
      <Text style={styles.smallBtnText}>{label}</Text>
    </Pressable>
  );
}

function PlayerRoster({
  players,
  hostId,
  highlight,
}: {
  players: PlayerSnapshot[];
  hostId: string | null;
  highlight?: (p: PlayerSnapshot) => boolean;
}) {
  return (
    <View style={styles.roster}>
      {players.map((p) => {
        const isHi = highlight?.(p) ?? false;
        return (
          <View key={p.user_id} style={[styles.rosterRow, isHi && styles.rosterRowHi]}>
            <Text style={styles.rosterName}>
              {p.display_name}
              {p.user_id === hostId ? ' ★' : ''}
            </Text>
            <Text style={styles.rosterStake}>{p.stake} 💎</Text>
          </View>
        );
      })}
    </View>
  );
}

function PeerCharge({ player }: { player: PlayerSnapshot }) {
  return (
    <ChargeMeter
      testID={`peer-${player.user_id}`}
      label={player.display_name}
      progress={player.progress}
      color={player.is_charging ? colors.purple : 'rgba(107,79,255,0.55)'}
      height={8}
    />
  );
}

// (ShareRow moved into RevealAnimation.tsx where it has access to the cue/timing context.)

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111111' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#2A2A2A',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: '#fff' },
  title: {
    flex: 1,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    color: '#fff',
    letterSpacing: -0.4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 10,
    color: colors.yellow,
    letterSpacing: 0.5,
  },
  errorBanner: {
    margin: 12,
    padding: 10,
    backgroundColor: 'rgba(238,51,85,0.18)',
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 6,
  },
  errorText: { fontFamily: fontFamilies.bold, fontSize: 12, color: '#fff' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 14 },
  insufficientText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.red,
    textAlign: 'center',
  },
  h2: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  bodyText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: '#F5F5F0',
    marginBottom: 6,
  },
  label: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
    marginTop: 8,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontFamily: fontFamilies.monoSemiBold, fontSize: 12, color: '#F5F5F0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnGroup: { gap: 10 },
  primaryBtn: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: colors.fg,
  },
  primaryBtnTextDisabled: { color: 'rgba(0,0,0,0.45)' },
  smallBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#2A2A2A',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { fontFamily: fontFamilies.extraBold, fontSize: 22, color: '#fff' },
  bigNum: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 42,
    color: '#fff',
    minWidth: 60,
    textAlign: 'center',
  },
  giant: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 120,
    color: colors.yellow,
    letterSpacing: -4,
    marginBottom: 8,
  },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#2A2A2A',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 6,
    color: '#fff',
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 16,
    letterSpacing: 2,
  },
  codeBox: {
    backgroundColor: '#2A2A2A',
    borderWidth: 2.5,
    borderColor: colors.yellow,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  codeLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  codeValue: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 38,
    color: colors.yellow,
    letterSpacing: 6,
  },
  codeHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 8,
    textAlign: 'center',
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    marginVertical: 12,
  },
  roster: { gap: 6, marginTop: 6 },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2A2A2A',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
  },
  rosterRowHi: { borderColor: colors.green },
  rosterName: { fontFamily: fontFamilies.bold, fontSize: 13, color: '#fff' },
  rosterStake: { fontFamily: fontFamilies.monoSemiBold, fontSize: 13, color: colors.purpleLight },
  chargeBtn: {
    height: 80,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: 12,
  },
  chargeFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(51,51,51,0.45)',
  },
  chargeBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 24,
    color: colors.fg,
    letterSpacing: 1,
  },
  allChargedCue: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    color: colors.yellow,
    textAlign: 'center',
    marginVertical: 8,
    letterSpacing: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2A2A2A',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
  },
  breakdownRowMe: { borderColor: colors.yellow },
  breakdownSeat: { fontFamily: fontFamilies.bold, fontSize: 13, color: '#fff' },
  breakdownPts: { fontFamily: fontFamilies.extraBold, fontSize: 15, color: colors.yellow },
});
