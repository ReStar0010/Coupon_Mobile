import { applyFrame, clearLastError, INITIAL_COOP_STATE } from '../coopReducer';
import type { ServerFrame } from '../coopProtocol';

const makeCreated = (
  overrides: Partial<ServerFrame & { type: 'room.created' }> = {},
): ServerFrame => ({
  v: 1,
  type: 'room.created',
  ts: 0,
  seq: 1,
  room_id: 'rid',
  body: {
    room_id: 'rid',
    code: 'ABCDEF',
    host_id: 'u1',
    max_players: 3,
    expires_at: 60_000,
    state: 'LOBBY_OPEN',
    players: [
      {
        user_id: 'u1',
        seat: 0,
        display_name: 'Alice',
        avatar_url: null,
        stake: 1,
        locked: false,
        progress: 0,
        is_charging: false,
        connected: true,
      },
    ],
  },
  ...overrides,
});

describe('coopReducer', () => {
  it('starts at INITIAL_COOP_STATE', () => {
    expect(INITIAL_COOP_STATE.phase).toBeNull();
    expect(INITIAL_COOP_STATE.players).toHaveLength(0);
  });

  it('room.created sets identity + lobby fields', () => {
    const s = applyFrame(INITIAL_COOP_STATE, makeCreated());
    expect(s.roomId).toBe('rid');
    expect(s.code).toBe('ABCDEF');
    expect(s.hostId).toBe('u1');
    expect(s.phase).toBe('LOBBY_OPEN');
    expect(s.players).toHaveLength(1);
    expect(s.expiresAt).toBe(60_000);
    expect(s.gemsTotal).toBe(1);
  });

  it('room.staked updates G_total + floor preview', () => {
    let s = applyFrame(INITIAL_COOP_STATE, makeCreated());
    const frame: ServerFrame = {
      v: 1,
      type: 'room.staked',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      body: {
        players: [{ ...s.players[0], stake: 3 }],
        G_total: 3,
        P: 1,
        f_preview: 1,
        all_locked: false,
        state: 'STAKING',
      },
    };
    s = applyFrame(s, frame);
    expect(s.phase).toBe('STAKING');
    expect(s.gemsTotal).toBe(3);
    expect(s.floorPreview).toBe(1);
  });

  it('room.ready sets the final floor', () => {
    let s = applyFrame(INITIAL_COOP_STATE, makeCreated());
    s = applyFrame(s, {
      v: 1,
      type: 'room.ready',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      body: {
        players: s.players,
        G_total: 3,
        P: 1,
        f: 1,
        auto_countdown_in_ms: 2000,
        state: 'READY',
      },
    });
    expect(s.phase).toBe('READY');
    expect(s.floor).toBe(1);
  });

  it('room.countdown ticks update countdownTick', () => {
    let s = applyFrame(INITIAL_COOP_STATE, makeCreated());
    s = applyFrame(s, {
      v: 1,
      type: 'room.countdown',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      body: { tick: 3, started_at: 1000, duration_ms: 3000, state: 'COUNTDOWN' },
    });
    expect(s.phase).toBe('COUNTDOWN');
    expect(s.countdownTick).toBe(3);
  });

  it('room.charging carries player progress through', () => {
    let s = applyFrame(INITIAL_COOP_STATE, makeCreated());
    s = applyFrame(s, {
      v: 1,
      type: 'room.charging',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      body: {
        players: [{ ...s.players[0], progress: 0.42, is_charging: true }],
        started_at: 1000,
        duration_ms: 2500,
        state: 'CHARGING',
      },
    });
    expect(s.phase).toBe('CHARGING');
    expect(s.players[0].progress).toBeCloseTo(0.42);
    expect(s.players[0].is_charging).toBe(true);
  });

  it('room.reveal stores the full reveal payload', () => {
    let s = applyFrame(INITIAL_COOP_STATE, makeCreated());
    s = applyFrame(s, {
      v: 1,
      type: 'room.reveal',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      body: {
        round_id: 'r1',
        M: 4,
        G_total: 3,
        f: 1,
        total_payout: 12,
        shares: [{ user_id: 'u1', seat: 0, stake: 3, floor: 3, excess: 9, share: 12 }],
        reveal_plan: { phases: [] },
        state: 'REVEAL',
      },
    });
    expect(s.phase).toBe('REVEAL');
    expect(s.reveal?.M).toBe(4);
    expect(s.reveal?.totalPayout).toBe(12);
    expect(s.reveal?.shares).toHaveLength(1);
  });

  it('room.settled records credits', () => {
    let s = applyFrame(INITIAL_COOP_STATE, makeCreated());
    s = applyFrame(s, {
      v: 1,
      type: 'room.settled',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      body: { round_id: 'r1', credited: { u1: 12 }, state: 'SETTLED' },
    });
    expect(s.phase).toBe('SETTLED');
    expect(s.credited).toEqual({ u1: 12 });
  });

  it('room.aborted sets ABORTED phase + reason', () => {
    let s = applyFrame(INITIAL_COOP_STATE, makeCreated());
    s = applyFrame(s, {
      v: 1,
      type: 'room.aborted',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      body: { round_id: 'r1', reason: 'disconnect', refunded: { u1: 3 }, state: 'DISPOSED' },
    });
    expect(s.phase).toBe('ABORTED');
    expect(s.abortReason).toBe('disconnect');
  });

  it('error frame populates lastError', () => {
    const s = applyFrame(INITIAL_COOP_STATE, {
      v: 1,
      type: 'error',
      ts: 0,
      body: { code: 'ROOM_FULL', message: 'sorry', command: 'room.join' },
    });
    expect(s.lastError?.code).toBe('ROOM_FULL');
  });

  it('clearLastError no-ops when lastError is null', () => {
    expect(clearLastError(INITIAL_COOP_STATE)).toBe(INITIAL_COOP_STATE);
  });

  it('clearLastError clears the lastError field', () => {
    const s = applyFrame(INITIAL_COOP_STATE, {
      v: 1,
      type: 'error',
      ts: 0,
      body: { code: 'ROOM_FULL', message: 'sorry', command: 'room.join' },
    });
    expect(s.lastError).not.toBeNull();
    expect(clearLastError(s).lastError).toBeNull();
  });

  it('extracts you_are from envelope into state.meUserId', () => {
    let s = applyFrame(INITIAL_COOP_STATE, {
      ...makeCreated(),
      you_are: 'u-bob',
    } as unknown as ServerFrame);
    expect(s.meUserId).toBe('u-bob');
    // Subsequent frame without you_are leaves meUserId intact
    s = applyFrame(s, {
      v: 1,
      type: 'room.staked',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      body: {
        players: s.players,
        G_total: 1,
        P: 1,
        f_preview: 0,
        all_locked: false,
        state: 'STAKING',
      },
    });
    expect(s.meUserId).toBe('u-bob');
  });

  it('updates meUserId when a later frame ships a different you_are', () => {
    let s = applyFrame(INITIAL_COOP_STATE, {
      ...makeCreated(),
      you_are: 'u-alice',
    } as unknown as ServerFrame);
    s = applyFrame(s, {
      v: 1,
      type: 'room.staked',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      you_are: 'u-bob',
      body: {
        players: s.players,
        G_total: 1,
        P: 1,
        f_preview: 0,
        all_locked: false,
        state: 'STAKING',
      },
    } as unknown as ServerFrame);
    expect(s.meUserId).toBe('u-bob');
  });

  it('room.host_changed swaps hostId', () => {
    let s = applyFrame(INITIAL_COOP_STATE, makeCreated());
    s = applyFrame(s, {
      v: 1,
      type: 'room.host_changed',
      ts: 0,
      seq: 2,
      room_id: 'rid',
      body: { previous_host_id: 'u1', new_host_id: 'u2', players: s.players },
    });
    expect(s.hostId).toBe('u2');
  });
});
