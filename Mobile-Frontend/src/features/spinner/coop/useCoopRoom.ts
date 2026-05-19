/**
 * React hook bridging CoopClient ↔ reducer.
 *
 * v3 C-1: `token` is held in a ref so passing an inline `() => fetchToken()`
 * doesn't tear down + reconnect the WebSocket on every render. The effect
 * dep array is `[enabled, baseUrl]` only.
 *
 * v3 H-3: a `released` flag in the cleanup closure prevents post-unmount
 * `dispatch` / `setStatus` calls from in-flight WS frames.
 *
 * v2 H-1: status is real React state so the UI re-renders on open/close.
 * v2 H-3: identity flows server-side via `you_are`, not from props.
 * v2 H-5: errors auto-clear via `clearError()` exposed on the hook.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { CoopClient, type TokenProvider } from './coopClient';
import { applyFrame, clearLastError, type CoopState, INITIAL_COOP_STATE } from './coopReducer';
import type { ClientCommand, ServerFrame } from './coopProtocol';

export type CoopStatus = 'closed' | 'connecting' | 'open' | 'closing';

interface UseCoopRoomOptions {
  /** JWT access token, or a thunk returning a fresh one on each connect.
   *  Identity is held by reference — caller can pass a new value any render
   *  without triggering reconnects. */
  token: TokenProvider;
  baseUrl?: string;
  /** When false, the client doesn't connect (useful in tests / disabled state). */
  enabled?: boolean;
}

interface UseCoopRoomResult {
  state: CoopState;
  status: CoopStatus;
  send: (cmd: ClientCommand) => boolean;
  close: () => void;
  clearError: () => void;
  createRoom: (solo: boolean) => boolean;
  joinRoom: (target: { code?: string; room_id?: string }) => boolean;
  leaveRoom: () => boolean;
  setStake: (gems: number) => boolean;
  lockStake: () => boolean;
  unlockStake: () => boolean;
  startCountdown: () => boolean;
  pressIn: () => boolean;
  pressOut: () => boolean;
  ackReveal: (roundId: string) => boolean;
  requestRematch: () => boolean;
}

type Action = { kind: 'frame'; frame: ServerFrame } | { kind: 'clear-error' } | { kind: 'reset' };

function reducer(state: CoopState, action: Action): CoopState {
  switch (action.kind) {
    case 'reset':
      return INITIAL_COOP_STATE;
    case 'clear-error':
      return clearLastError(state);
    case 'frame':
      return applyFrame(state, action.frame);
  }
}

export function useCoopRoom(options: UseCoopRoomOptions): UseCoopRoomResult {
  const { token, baseUrl, enabled = true } = options;
  const [state, dispatch] = useReducer(reducer, INITIAL_COOP_STATE);
  const [status, setStatus] = useState<CoopStatus>('closed');
  const clientRef = useRef<CoopClient | null>(null);

  // v3 C-1: keep the latest token in a ref so the effect's deps don't include
  // it. The CoopClient reads this ref via a closure on each (re)connect.
  const tokenRef = useRef<TokenProvider>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!enabled) {
      setStatus('closed');
      return;
    }
    // v3 H-3: in-flight WS callbacks must not poke the reducer / state
    // setters after we've torn down. The flag is captured by the closures.
    let released = false;

    const client = new CoopClient({
      token: () => {
        const t = tokenRef.current;
        return typeof t === 'string' ? t : t();
      },
      baseUrl,
      onFrame: (frame) => {
        if (!released) dispatch({ kind: 'frame', frame });
      },
      onOpen: () => {
        if (!released) setStatus('open');
      },
      onClose: () => {
        if (!released) setStatus('closed');
      },
    });
    clientRef.current = client;
    setStatus('connecting');
    client.connect();

    return () => {
      released = true;
      client.close();
      clientRef.current = null;
      setStatus('closed');
      dispatch({ kind: 'reset' });
    };
  }, [enabled, baseUrl]);

  const send = useCallback(
    (cmd: ClientCommand) => (clientRef.current ? clientRef.current.send(cmd) : false),
    [],
  );
  const close = useCallback(() => clientRef.current?.close(), []);
  const clearError = useCallback(() => dispatch({ kind: 'clear-error' }), []);

  const helpers = useMemo(
    () => ({
      createRoom: (solo: boolean) => send({ type: 'room.create', body: { solo } }),
      joinRoom: (target: { code?: string; room_id?: string }) =>
        send({ type: 'room.join', body: target }),
      leaveRoom: () => send({ type: 'room.leave', body: {} }),
      setStake: (gems: number) => send({ type: 'stake.set', body: { gems } }),
      lockStake: () => send({ type: 'stake.lock', body: {} }),
      unlockStake: () => send({ type: 'stake.unlock', body: {} }),
      startCountdown: () => send({ type: 'countdown.start', body: {} }),
      pressIn: () => send({ type: 'charge.press_in', body: { at: Date.now() } }),
      pressOut: () => send({ type: 'charge.press_out', body: { at: Date.now() } }),
      ackReveal: (roundId: string) => send({ type: 'reveal.ack', body: { round_id: roundId } }),
      requestRematch: () => send({ type: 'rematch.request', body: {} }),
    }),
    [send],
  );

  return { state, status, send, close, clearError, ...helpers };
}
