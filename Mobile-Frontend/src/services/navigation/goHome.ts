import type { Router } from 'expo-router';

/** Minimal slice of expo-router's `Router` that `goHome` depends on. */
type HomeNavigator = Pick<Router, 'canDismiss' | 'dismissAll' | 'replace'>;

/**
 * Return to the home tab from a pushed flow (coupon detail / share / qr,
 * coupoint use).
 *
 * These screens are pushed on top of the `(tabs)` group, and several end on
 * a full-screen success overlay that blocks all input and self-dismisses
 * only via a timer. A plain `router.push('/(tabs)/home')` navigated forward
 * but left that overlay screen alive in the back stack — pressing Android
 * back then returned the user to a permanently frozen "已分享！" overlay (its
 * timer had already fired, and the overlay has no escape button). It also
 * stacked a duplicate home screen.
 *
 * `dismissAll` pops the whole pushed stack, tearing the overlay down so the
 * real home tab becomes the top screen. `replace` is the fallback for the
 * rare case where there is nothing to dismiss (e.g. deep-linked straight
 * into the flow).
 */
export function goHome(router: HomeNavigator): void {
  if (router.canDismiss()) {
    router.dismissAll();
  } else {
    router.replace('/(tabs)/home');
  }
}
