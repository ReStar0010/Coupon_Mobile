/**
 * Tiny synchronous pub/sub so a "re-watch the tutorial" reset can tell every
 * currently-mounted coach-mark to re-evaluate its seen-flag immediately —
 * without depending on a navigation context (useFocusEffect would require
 * one and break headless hook/component tests).
 *
 * `useCoachmark` subscribes via useSyncExternalStore and re-reads its flag
 * whenever the epoch bumps. Screens mounted later still re-read on mount as
 * before, so the two paths together cover both the already-open tab and the
 * not-yet-visited screen.
 */
type Listener = () => void;

let epoch = 0;
const listeners = new Set<Listener>();

export function getOnboardingResetEpoch(): number {
  return epoch;
}

export function subscribeOnboardingReset(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Bump the epoch and notify subscribers. Called after onboarding flags clear. */
export function notifyOnboardingReset(): void {
  epoch += 1;
  listeners.forEach((l) => l());
}
