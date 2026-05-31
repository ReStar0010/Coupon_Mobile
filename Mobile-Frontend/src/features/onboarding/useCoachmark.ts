import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  hasSeenCoachmark,
  markCoachmarkSeen,
  type CoachmarkScreen,
} from '@/src/services/onboarding/onboardingState';
import {
  getOnboardingResetEpoch,
  subscribeOnboardingReset,
} from '@/src/services/onboarding/onboardingResetBus';

interface CoachmarkState {
  visible: boolean;
  step: number;
  next: () => void;
  done: () => void;
}

/**
 * Drives the per-screen coach-mark overlay.
 *
 * Defaults to `visible=false` until the AsyncStorage read resolves; this
 * means we never flash the dim overlay on top of a normally-rendered
 * screen during the first paint. Once we learn the user hasn't seen this
 * screen's coach mark, we flip to `visible=true`.
 *
 * `next()` advances the local step counter (the overlay component owns
 * what each step shows). `done()` persists the seen flag and hides the
 * overlay for good. If persistence fails, `visible` still flips to false
 * — the user shouldn't be trapped in the overlay because storage hiccupped.
 */
export function useCoachmark(screen: CoachmarkScreen): CoachmarkState {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  // Re-runs the seen-check whenever the screen changes OR an onboarding reset
  // bumps the epoch (the "re-watch tutorial" flow), so an already-mounted tab
  // re-shows its coach-mark without needing a remount.
  const resetEpoch = useSyncExternalStore(
    subscribeOnboardingReset,
    getOnboardingResetEpoch,
    getOnboardingResetEpoch,
  );

  useEffect(() => {
    let cancelled = false;
    // Restart from the first step on (re)evaluation so a replay begins at 0.
    setStep(0);
    hasSeenCoachmark(screen).then((seen) => {
      if (!cancelled) setVisible(!seen);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, resetEpoch]);

  const next = useCallback(() => setStep((s) => s + 1), []);

  const done = useCallback(() => {
    setVisible(false);
    void markCoachmarkSeen(screen);
  }, [screen]);

  return { visible, step, next, done };
}
