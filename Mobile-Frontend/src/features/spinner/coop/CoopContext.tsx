import React, { createContext, useContext, useCallback, useState } from 'react';

import { useCoopRoom, type CoopStatus } from './useCoopRoom';
import type { CoopState } from './coopReducer';
import type { ClientCommand } from './coopProtocol';
import type { TokenProvider } from './coopClient';
import { getAccessToken } from '@/src/services/auth/tokenStore';

interface CoopActions {
  send: (cmd: ClientCommand) => boolean;
  close: () => void;
  clearError: () => void;
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

interface CoopContextValue extends CoopActions {
  state: CoopState;
  status: CoopStatus;
  active: boolean;
  activate: () => void;
  deactivate: () => void;
}

const CoopCtx = createContext<CoopContextValue | null>(null);

export function useCoopContext(): CoopContextValue {
  const ctx = useContext(CoopCtx);
  if (!ctx) throw new Error('useCoopContext must be inside CoopProvider');
  return ctx;
}

const tokenThunk: TokenProvider = async () => (await getAccessToken()) ?? '';

export function CoopProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [active, setActive] = useState(false);

  const activate = useCallback(() => setActive(true), []);
  const deactivate = useCallback(() => setActive(false), []);

  const coop = useCoopRoom({ token: tokenThunk, enabled: active });

  return (
    <CoopCtx.Provider value={{ ...coop, active, activate, deactivate }}>
      {children}
    </CoopCtx.Provider>
  );
}
