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
import { refreshTokens } from '../../../services/auth/tokenStore';

export type CoopStatus = 'closed' | 'connecting' | 'open' | 'closing';

/** Mirrors `AUTH_FAILED_CLOSE_CODE` in `coopClient.ts`. */
const AUTH_FAILED_CLOSE_CODE = 4401;

interface UseCoopRoomOptions {
  /** JWT access token, or a thunk returning a fresh one on each connect.
   *  Identity is held by reference — caller can pass a new value any render
   *  without triggering reconnects. */
  token: TokenProvider;
  baseUrl?: string;
  /** When false, the client doesn't connect (useful in tests / disabled state). */
  enabled?: boolean;
}

export interface UseCoopRoomResult {
  state: CoopState;
  status: CoopStatus;
  send: (cmd: ClientCommand) => boolean;
  close: () => void;
  clearError: () => void;
  /** Re-open the WS connection. Used by the "Retry" button when the
   * connection has dropped (status === 'closed') without an explicit
   * user-initiated close. No-op if already connected. */
  reconnect: () => void;
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

  // Track whether we've already attempted a one-shot token refresh for the
  // current connection. We refresh AT MOST ONCE per lifecycle so a bad
  // refresh token (or a backend-side auth failure that survives refresh)
  // doesn't burn into a tight loop. Reset on explicit reconnect().
  const authRefreshAttemptedRef = useRef(false);

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
        // Successful (re)open clears the refresh-attempted guard so a
        // later 4401 in the same session can trigger another refresh.
        authRefreshAttemptedRef.current = false;
      },
      onClose: (_reason, code) => {
        if (released) return;
        // Auth failure (4401): the JWT we presented is stale. Try to
        // refresh ONCE, then reconnect with the new token. If refresh
        // fails (or has already been attempted this lifecycle), surface
        // an AUTH_FAILED error frame so the UI can prompt the user.
        if (code === AUTH_FAILED_CLOSE_CODE && !authRefreshAttemptedRef.current) {
          authRefreshAttemptedRef.current = true;
          refreshTokens()
            .then(() => {
              if (released) return;
              setStatus('connecting');
              client.connect();
            })
            .catch(() => {
              if (released) return;
              // SESSION_EXPIRED is the closest existing ErrorCode for "JWT
              // refresh failed, user must log in again." The backend's
              // ErrorCode enum (api/spinner_coop/events.py) uses the
              // same name for the same condition.
              dispatch({
                kind: 'frame',
                frame: {
                  v: 1,
                  type: 'error',
                  ts: Date.now(),
                  body: {
                    code: 'SESSION_EXPIRED',
                    message: '請重新登入',
                    command: null,
                  },
                } as ServerFrame,
              });
              setStatus('closed');
            });
          return;
        }
        setStatus('closed');
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
  const reconnect = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    // Allow a fresh refresh attempt — the user is asking us to try again.
    authRefreshAttemptedRef.current = false;
    setStatus('connecting');
    client.connect();
  }, []);

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

  return { state, status, send, close, clearError, reconnect, ...helpers };
}
