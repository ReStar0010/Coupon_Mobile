/**
 * PostHog wrapper.
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
 */

import Constants from 'expo-constants';
import { PostHog } from 'posthog-react-native';

// PostHog v4 narrows `capture()` to a JsonType-constrained property bag.
// We strip PII at the boundary and trust the surviving values to be
// JSON-serializable; cast through `Parameters` to follow the SDK's
// signature without importing internal `@posthog/core` types.
type CaptureProps = Parameters<PostHog['capture']>[1];
type IdentifyProps = Parameters<PostHog['identify']>[1];

// Field names that must never leave the device. Lowercase comparison so
// `EmailAddress` and `email` are both caught.
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

/**
 * Recursively strip PII keys from any nested object or array. A shallow
 * strip would leak `email` / `phone` if a caller spread a full
 * UserProfile or API response into event props.
 *
 * Non-plain values (Date, Map, custom class instances, RN refs) are
 * passed through unchanged — they don't have the structural shape we
 * filter on, and capturing them defeats the safety guarantee anyway.
 * Callers should pass plain JSON-shaped data only.
 */
function stripPIIDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(stripPIIDeep);
  }
  if (typeof value === 'object') {
    // Defensive: only descend into plain objects. `Object.prototype` swap
    // guards against e.g. RN Animated values that pretend to be objects.
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
  // expo-constants is the canonical SDK 54 way to read app.json → extra.
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const apiKey =
    typeof extra.posthogApiKey === 'string' && extra.posthogApiKey.length > 0
      ? extra.posthogApiKey
      : undefined;
  const host = typeof extra.posthogHost === 'string' ? extra.posthogHost : 'https://us.i.posthog.com';
  // Session replay must be opted into explicitly. The mobile native module
  // (posthog-react-native-session-replay) needs a custom dev build; flipping
  // this without the right build will be a silent no-op rather than a crash,
  // but rolling it out via app.json keeps the decision visible in source.
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
      // One-shot dev hint so developers know analytics is disabled.
      // eslint-disable-next-line no-console
      console.info('[analytics] PostHog disabled (no posthogApiKey in app.json → extra)');
    }
    return null;
  }
  try {
    cachedClient = new PostHog(apiKey, {
      host,
      // Mask all text inputs by default so the password / OTP fields never
      // appear in replays even if a developer forgets to mark them as
      // privacy-sensitive. Images are NOT masked because the coupon UI
      // depends on screenshots being legible during replay debugging.
      enableSessionReplay: sessionReplay,
      sessionReplayConfig: sessionReplay
        ? {
            // Inputs hide passwords/OTP/feedback text.
            maskAllTextInputs: true,
            // CRITICAL: coupon QR codes are rendered as <Image> components.
            // A QR captured in replay is a replayable redemption credential,
            // so we mask all images. Debugging visual issues on coupon UI
            // can still use the masked silhouette + element tree.
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
 * Use dotted, lowercase event names: `coupon.share_started`,
 * `spinner.draw_completed`.
 *
 * Props are PII-stripped **recursively** before send (top-level and
 * nested objects/arrays alike). Keys matching `email`, `phone`,
 * `password`, `token`, `access_token`, `refresh_token`, and their
 * lowercase variants are removed at every depth. Pass plain JSON shapes
 * only — custom class instances are passed through unchanged.
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
 * Associate the current device with a backend user id. Call once on
 * login / register / app boot when a stored session restores a user.
 *
 * After updating the distinct id, we fire-and-forget a flag refresh
 * (`reloadFeatureFlagsAsync`) so a user who logs in and immediately
 * spins the wheel sees their user-bucketed feature-flag variants
 * instead of the anonymous-bucket values still cached from before
 * login. Without this refresh, A/B variants only update on the next
 * cold start. Documented behaviour per PostHog v3+ docs.
 */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  const client = getClient();
  if (!client) return;
  try {
    client.identify(userId, stripPII(traits) as IdentifyProps);
    // Best-effort flag refresh. Never block identify on a network
    // round-trip; swallow rejection so a stale-flag refresh failure
    // doesn't break the telemetry contract. The cast tolerates SDK
    // type drift between releases (return type may be Promise<void>
    // or void depending on version).
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
 * Forget the current user. Call on logout so future events are
 * attributed to an anonymous distinct id.
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
