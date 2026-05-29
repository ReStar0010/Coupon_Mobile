/**
 * Onboarding persistence — single source of truth for "has this user
 * seen the launch intro / the coach mark for screen X?" flags.
 *
 * Both surfaces use a version suffix so a future redesign can bump the
 * suffix to re-show without erasing existing user data. Failures degrade
 * to "not seen" — over-showing is recoverable; under-showing on a
 * fresh install would deprive new users of the tour.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_VERSION = 1;
const COACHMARK_VERSION = 1;

const LAUNCH_KEY = `onboarding_v${ONBOARDING_VERSION}_seen`;

export type CoachmarkScreen =
  | 'home'
  | 'map'
  | 'spinner'
  | 'coupon-detail'
  | 'coupon-share'
  | 'settings';

export const COACHMARK_KEYS: readonly CoachmarkScreen[] = [
  'home',
  'map',
  'spinner',
  'coupon-detail',
  'coupon-share',
  'settings',
] as const;

function coachKey(screen: CoachmarkScreen): string {
  return `coach_v${COACHMARK_VERSION}_${screen}`;
}

export async function hasSeenLaunchOnboarding(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(LAUNCH_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function markLaunchOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAUNCH_KEY, '1');
  } catch {
    // Swallow — over-showing the intro is fine; crashing the
    // "Start using CouPro" tap is not.
  }
}

export async function hasSeenCoachmark(screen: CoachmarkScreen): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(coachKey(screen));
    return v === '1';
  } catch {
    return false;
  }
}

export async function markCoachmarkSeen(screen: CoachmarkScreen): Promise<void> {
  try {
    await AsyncStorage.setItem(coachKey(screen), '1');
  } catch {
    // Swallow — coach mark will re-show on next visit; not a crash.
  }
}

/** Dev affordance — hidden 5-tap on Settings version row resets all coach-marks. */
export async function resetAllCoachmarks(): Promise<void> {
  await Promise.all(
    COACHMARK_KEYS.map((s) => AsyncStorage.removeItem(coachKey(s)).catch(() => undefined)),
  );
}
