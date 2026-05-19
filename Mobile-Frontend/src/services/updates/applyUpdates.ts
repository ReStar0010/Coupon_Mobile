import * as Updates from 'expo-updates';

/**
 * Launch-time EAS Update apply helper.
 *
 * Why a deadline:
 *   The default fetch flow can hang on a slow network — the user is
 *   left staring at the splash for the full axios timeout (or the
 *   Expo native splash timeout of 3s + our budget). Racing the
 *   check+download against a hard deadline lets the user open the app
 *   immediately if the update can't be fetched in time. Any partial
 *   download persists in expo-updates' cache and will finish on the
 *   next launch.
 *
 * Why a string sentinel return type instead of boolean:
 *   Caller may want to surface a banner ("update available, retrying
 *   in background") for the 'timed-out' case; lumping it with errors
 *   would muddy that decision.
 */
export type ApplyUpdateResult =
  | 'disabled' // Updates.isEnabled === false (Expo Go / dev)
  | 'no-update' // server reports current bundle is current
  | 'reloading' // fetched + reloadAsync called; app is about to restart
  | 'timed-out' // network didn't finish before deadline
  | 'error'; // unexpected throw — already swallowed

interface ApplyUpdateOptions {
  /**
   * Hard ceiling for the entire check + download + reload trigger.
   * Recommended: 5000 ms. The native splash auto-hides at ~3s
   * (`fallbackToCacheTimeout`), and we want our race to lose to it
   * gracefully if the network is too slow.
   */
  deadlineMs: number;
}

export async function tryApplyUpdate({ deadlineMs }: ApplyUpdateOptions): Promise<ApplyUpdateResult> {
  if (!Updates.isEnabled) return 'disabled';

  const timeoutSentinel = Symbol('apply-update-timeout');
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<typeof timeoutSentinel>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(timeoutSentinel), deadlineMs);
  });

  // Wrap the whole check/fetch/reload chain so a single try-catch
  // covers every reject. The race resolves on EITHER the chain
  // settling OR the deadline firing.
  const work = (async (): Promise<ApplyUpdateResult> => {
    const check = await Updates.checkForUpdateAsync();
    if (!check?.isAvailable) return 'no-update';
    await Updates.fetchUpdateAsync();
    // reloadAsync resolves only AFTER the native side has rebooted JS,
    // but in practice the JS thread is killed mid-promise so callers
    // never see this resolution. Returning 'reloading' is informational
    // for the in-flight caller.
    await Updates.reloadAsync();
    return 'reloading';
  })();

  try {
    const winner = await Promise.race([work, timeoutPromise]);
    if (winner === timeoutSentinel) return 'timed-out';
    return winner;
  } catch {
    return 'error';
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
}
