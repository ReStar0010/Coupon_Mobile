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
 */

import { getClient } from './posthog';

export function getFlag<T extends string | boolean>(key: string, fallback: T): T {
  const client = getClient();
  if (!client) return fallback;
  try {
    const value = client.getFeatureFlag(key);
    if (value === undefined || value === null) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}
