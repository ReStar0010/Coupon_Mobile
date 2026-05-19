/**
 * Custom hook that returns a function which, when called, forces the calling
 * component to re-render.
 *
 * Useful for animation loops that read off a ref (e.g. the local charge
 * interpolation in ChargingView) where the values change faster than React's
 * own state model wants to acknowledge.
 *
 * Per `~/.claude/plugins/.../frontend-patterns` — small focused custom hooks
 * over inline `useState(0)` re-render hacks.
 */

import { useCallback, useState } from 'react';

export function useForceUpdate(): () => void {
  const [, setTick] = useState(0);
  // v3 M-3: mask to 31 bits so a 60Hz tick over years can't approach
  // Number.MAX_SAFE_INTEGER. The bitwise op preserves identity-change semantics
  // (each call still produces a different number), so React still re-renders.
  return useCallback(() => setTick((n) => (n + 1) & 0x7fffffff), []);
}
