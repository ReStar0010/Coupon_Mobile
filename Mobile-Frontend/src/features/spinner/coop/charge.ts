/**
 * Pure charge-meter math.
 *
 * Server is the source of truth: it broadcasts each player's progress at 10Hz
 * (every 100ms). The client renders smooth fills by either:
 *
 *   1. low-pass filtering the server progress (peer meters) — see useSmoothed()
 *      in the ChargeMeter component, or
 *   2. dead-reckoning from the local press_in timestamp (the local user's own
 *      meter) — see interpolateLocalCharge() below.
 *
 * Per spec §3.4: dead-reckoning may extend up to 100ms past the last server
 * confirmation; on receipt of the next server frame the meter snaps to the
 * confirmed value.
 */

export const MAX_DEAD_RECKON_MS = 100;

export interface LocalChargeArgs {
  /** Server-confirmed progress at the last tick. */
  serverProgress: number;
  /** Whether the player is currently pressing the button per server. */
  isCharging: boolean;
  /** When the local user's own press began (Date.now() at onPressIn). null if not pressing. */
  pressedAtMs: number | null;
  /** Now in ms. */
  nowMs: number;
  /** Total charge duration (defaults to 2500ms). */
  durationMs?: number;
}

/**
 * Estimate the LOCAL user's charge progress, dead-reckoning forward from the
 * last server confirmation. Capped at MAX_DEAD_RECKON_MS so we can't drift
 * arbitrarily far past the server.
 *
 * Returns a value in [0, 1].
 */
export function interpolateLocalCharge(args: LocalChargeArgs): number {
  const { serverProgress, isCharging, pressedAtMs, nowMs, durationMs = 2500 } = args;

  const clamped = Math.max(0, Math.min(1, serverProgress));
  if (!isCharging || pressedAtMs === null) {
    return clamped;
  }

  const elapsed = Math.max(0, nowMs - pressedAtMs);
  const cappedElapsed = Math.min(elapsed, MAX_DEAD_RECKON_MS);
  const delta = cappedElapsed / Math.max(1, durationMs);
  return Math.min(1, clamped + delta);
}

/** True iff every player has progress >= 1.0. */
export function allFullyCharged(progresses: readonly number[]): boolean {
  if (progresses.length === 0) return false;
  return progresses.every((p) => p >= 1.0);
}
