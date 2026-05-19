import React from 'react';
import OnboardingOverlay, { type ScreenKey } from '@/src/components/onboarding/OnboardingOverlay';
import { useCoachmark } from './useCoachmark';
import type { CoachmarkScreen } from '@/src/services/onboarding/onboardingState';

/**
 * Single-call wrapper that wires up the per-screen coach mark.
 *
 * Drop `<Coachmark screen="home" />` once at the top of a screen's root
 * View — it owns its own visibility/persistence, so the parent stays
 * decoupled. `OnboardingOverlay` already returns null when there's no
 * step to render, so the wrapper is a no-op once the user has tapped
 * through every spotlight.
 */
interface CoachmarkProps {
  screen: CoachmarkScreen & ScreenKey;
}

export default function Coachmark({ screen }: CoachmarkProps): React.JSX.Element | null {
  const { visible, step, next, done } = useCoachmark(screen);
  if (!visible) return null;
  return <OnboardingOverlay screenKey={screen} step={step} onNext={next} onDone={done} />;
}
