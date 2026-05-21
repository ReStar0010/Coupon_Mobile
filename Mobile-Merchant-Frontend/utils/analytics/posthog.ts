/**
 * PostHog wrapper (merchant app).
 *
 * Single source of truth for product analytics. Three guarantees:
 *
 *  1. **Silent no-op without API key.** Dev builds, CI, and any environment
 *     missing `posthogApiKey` in `app.json → extra` get a wrapper whose
 *     methods do nothing. Lets feature code call `track()` unconditionally
 *     without environment branches at every call site.
 *
 *  2. **PII stripping at the boundary.** Event props and user traits are
 *     scrubbed of fields named `email`, `phone`, `password`, `token`,
 *     `refresh_token`, and `access_token` before they cross the wire.
 *     Belt-and-suspenders: PostHog's session-replay also masks inputs, but
 *     a top-level allowlist-by-omission catches accidental leaks at the
 *     source.
 *
 *  3. **Never throws.** A telemetry failure must not break the app, so
 *     every public method swallows its own exceptions and logs to console
 *     in dev. The contract is "best-effort, fire-and-forget".
 *
 * NOTE: kept structurally identical to Mobile-Frontend's wrapper so both
 * apps share one PII contract and one image-masking rule. Tests are also
 * cloned — keep them in sync if you change anything here.
 */

import Constants from 'expo-constants';
import { PostHog } from 'posthog-react-native';

type CaptureProps = Parameters<PostHog['capture']>[1];
type IdentifyProps = Parameters<PostHog['identify']>[1];

const PII_KEYS = new Set([
  'email',
  'phone',
  'phone_number',
  'phonenumber',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'accesstoken',
  'refreshtoken',
]);

function stripPIIDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(stripPIIDeep);
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase())) continue;
      out[k] = stripPIIDeep(v);
    }
    return out;
  }
  return value;
}

function stripPII(obj: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!obj) return {};
  return stripPIIDeep(obj) as Record<string, unknown>;
}

interface AnalyticsConfig {
  apiKey: string | undefined;
  host: string;
  sessionReplay: boolean;
}

function readConfig(): AnalyticsConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const apiKey =
    typeof extra.posthogApiKey === 'string' && extra.posthogApiKey.length > 0
      ? extra.posthogApiKey
      : undefined;
  const host =
    typeof extra.posthogHost === 'string' ? extra.posthogHost : 'https://us.i.posthog.com';
  const sessionReplay = extra.posthogSessionReplay === true;
  return { apiKey, host, sessionReplay };
}

let cachedClient: PostHog | null = null;
let initialized = false;

export function getClient(): PostHog | null {
  if (initialized) return cachedClient;
  initialized = true;
  const { apiKey, host, sessionReplay } = readConfig();
  if (!apiKey) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info('[analytics] PostHog disabled (no posthogApiKey in app.json → extra)');
    }
    return null;
  }
  try {
    cachedClient = new PostHog(apiKey, {
      host,
      enableSessionReplay: sessionReplay,
      sessionReplayConfig: sessionReplay
        ? {
            // Inputs hide passwords / OTP / feedback text.
            maskAllTextInputs: true,
            // Merchant app doesn't render redemption QR codes (those live
            // on the consumer side), but coupon images and store photos
            // can be commercially sensitive. Keep image masking on by
            // default so we don't accidentally ship store-internal
            // screenshots into replay debugging.
            maskAllImages: true,
          }
        : undefined,
    });
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] PostHog init failed', err);
    }
    cachedClient = null;
  }
  return cachedClient;
}

/**
 * Track a product event. Fire-and-forget; never throws.
 *
 * Use dotted, lowercase event names: `merchant.coupon_created`,
 * `merchant.redemption_completed`.
 */
export function track(eventName: string, props?: Record<string, unknown>): void {
  const client = getClient();
  if (!client) return;
  try {
    client.capture(eventName, stripPII(props) as CaptureProps);
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] track failed', eventName, err);
    }
  }
}

/**
 * Associate the current device with a backend merchant user id. Call once
 * on login and once on token-restore boot. Fires a best-effort flag
 * refresh so post-login A/B variants update without a cold start.
 */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  const client = getClient();
  if (!client) return;
  try {
    client.identify(userId, stripPII(traits) as IdentifyProps);
    const maybePromise = (client as { reloadFeatureFlagsAsync?: () => unknown })
      .reloadFeatureFlagsAsync?.();
    if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
      (maybePromise as Promise<unknown>).catch(() => undefined);
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] identify failed', err);
    }
  }
}

/**
 * Forget the current user. Call on logout (and after account deletion) so
 * future events are attributed to an anonymous distinct id.
 */
export function reset(): void {
  const client = getClient();
  if (!client) return;
  try {
    client.reset();
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] reset failed', err);
    }
  }
}

/** Test-only: clears the cached client between Jest runs. Not exported via index. */
export function _resetForTests(): void {
  cachedClient = null;
  initialized = false;
}
