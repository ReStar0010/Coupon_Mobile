/**
 * Feature-flag accessor — sits on top of the PostHog client so all flag
 * reads converge on a single, no-op-friendly entry point.
 *
 * Contract:
 *   - Returns `fallback` synchronously when no API key, when the flag
 *     hasn't loaded yet (PostHog returns `undefined`), or when the client
 *     throws.
 *   - Never throws, never blocks. Callers can safely use the result on
 *     every render without further guards.
 *
 * Typing nuance: PostHog returns `string | boolean | undefined`. The
 * generic `T extends string | boolean` lets feature code declare an
 * exhaustive variant union (e.g. `'default' | 'cheap' | 'bundled'`) and
 * still pin the return type.
 */

import { getClient } from './posthog';

export function getFlag<T extends string | boolean>(key: string, fallback: T): T {
  const client = getClient();
  if (!client) return fallback;
  try {
    const value = client.getFeatureFlag(key);
    if (value === undefined || value === null) return fallback;
    // PostHog returns strings for multivariate flags, booleans for binary
    // flags. The cast is safe because the caller's `fallback` constrains
    // T to one of those two shapes.
    return value as T;
  } catch {
    return fallback;
  }
}
