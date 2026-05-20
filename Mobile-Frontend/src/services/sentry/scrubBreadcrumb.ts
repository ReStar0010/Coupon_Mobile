/**
 * Sentry breadcrumb URL scrubber.
 *
 * The spinner co-op WebSocket auth puts JWT tokens in the URL query
 * string (`?token=…`) because the browser WebSocket API can't send
 * custom headers on the upgrade request. See
 * `Backend/api/spinner_coop/consumer.py` for the full rationale.
 *
 * `@sentry/react-native` captures fetch/xhr/WS URLs as breadcrumbs by
 * default, which would ship the JWT straight to Sentry. We wire this
 * scrubber as `beforeBreadcrumb` so every breadcrumb that crosses the
 * Sentry boundary gets its URL fields redacted.
 *
 * Token lifetime is short (10 min per SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']),
 * but redaction is defense-in-depth — Sentry persists breadcrumbs for
 * weeks beyond the token's TTL.
 */

/**
 * Param-name allowlist for redaction. Case-insensitive comparison
 * happens at scrub time, so list canonical names here.
 *
 * Exported so the test suite can iterate the same list the runtime uses
 * — no risk of test/impl drift when a new sensitive key is added.
 */
export const SENSITIVE_PARAM_KEYS: readonly string[] = [
  'token',
  'access_token',
  'refresh_token',
  'password',
  'secret',
  'api_key',
  'apikey',
  'auth',
];

const SENSITIVE_PARAM_SET: ReadonlySet<string> = new Set(
  SENSITIVE_PARAM_KEYS.map((k) => k.toLowerCase()),
);

const REDACTED = '[REDACTED]';

/**
 * Strip sensitive query-string values from a URL.
 *
 * Robust to:
 *   - Full URLs (`https://host/path?token=…`)
 *   - Path-only strings without a host (`GET /api/x?token=…`)
 *   - URLs with hash fragments (`https://host/x?token=…#section`)
 *   - Empty strings, plain text without `=` signs (no-op)
 *
 * Never throws — Sentry's breadcrumb pipeline must not be a crash
 * surface. On any unexpected parse failure we return the input
 * unchanged so the breadcrumb still ships (degraded but not lost).
 */
export function scrubUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  // Fast path: no `=` means no query params worth scrubbing.
  if (!raw.includes('=')) return raw;

  try {
    // Split off the fragment so we don't accidentally rewrite it.
    const hashIdx = raw.indexOf('#');
    const fragment = hashIdx >= 0 ? raw.slice(hashIdx) : '';
    const beforeHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;

    const queryIdx = beforeHash.indexOf('?');
    if (queryIdx < 0) return raw;

    const prefix = beforeHash.slice(0, queryIdx);
    const query = beforeHash.slice(queryIdx + 1);

    // Scrub each `key=value` pair independently. Using manual split
    // (not URLSearchParams) so the output preserves the original
    // separator characters and key casing — Sentry uses URLs as
    // event-grouping keys and aggressive normalization would create
    // duplicate issues.
    const scrubbedPairs = query.split('&').map((pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx < 0) return pair;
      const key = pair.slice(0, eqIdx);
      if (SENSITIVE_PARAM_SET.has(key.toLowerCase())) {
        return `${key}=${REDACTED}`;
      }
      return pair;
    });

    return `${prefix}?${scrubbedPairs.join('&')}${fragment}`;
  } catch {
    return raw;
  }
}

/**
 * Sentry `beforeBreadcrumb` hook. Receives a breadcrumb, returns a
 * scrubbed copy (or `null` to drop it entirely; we never drop).
 *
 * The breadcrumb shape varies by category — fetch/xhr put the URL in
 * `data.url`; navigation breadcrumbs use `data.from` / `data.to`. We
 * handle both rather than trying to enumerate every category Sentry
 * may emit.
 *
 * Typed as a minimal structural interface so the helper stays unit-
 * testable without depending on Sentry's full `Breadcrumb` interface.
 * The Sentry.init call site can pass this directly — Sentry's
 * `Breadcrumb` is a superset of `BreadcrumbLike`.
 */
export interface BreadcrumbLike {
  data?: Record<string, unknown>;
  category?: string;
  message?: string;
  // Other Sentry-defined fields (level, timestamp, type) survive the
  // spread at runtime but aren't enumerated in this interface — the
  // helper only reads `data`.
}

export function scrubBreadcrumb<T extends BreadcrumbLike>(breadcrumb: T | null): T | null {
  if (!breadcrumb) return breadcrumb;

  // Scrub the top-level `message` field too — react-native's network
  // layer can attach a full WS URL as a human-readable breadcrumb
  // message (`"WebSocket open: wss://…?token=…"`) separate from
  // `data.url`. Fast-path: only call into scrubUrl if `=` appears.
  let scrubbedMessage = breadcrumb.message;
  let messageMutated = false;
  if (typeof breadcrumb.message === 'string' && breadcrumb.message.includes('=')) {
    const candidate = scrubUrl(breadcrumb.message);
    if (candidate !== breadcrumb.message) {
      scrubbedMessage = candidate;
      messageMutated = true;
    }
  }

  // Scrub data.{url,from,to} — fetch/xhr breadcrumbs use `data.url`,
  // navigation breadcrumbs use `data.from` / `data.to`.
  const data = breadcrumb.data;
  let dataMutated = false;
  let scrubbedData: Record<string, unknown> | undefined = data;

  if (data && typeof data === 'object') {
    scrubbedData = { ...data };
    for (const key of ['url', 'from', 'to'] as const) {
      const value = data[key];
      if (typeof value === 'string') {
        const scrubbed = scrubUrl(value);
        if (scrubbed !== value) {
          scrubbedData[key] = scrubbed;
          dataMutated = true;
        }
      }
    }
  }

  if (!messageMutated && !dataMutated) return breadcrumb;
  return {
    ...breadcrumb,
    ...(messageMutated ? { message: scrubbedMessage } : {}),
    ...(dataMutated ? { data: scrubbedData } : {}),
  };
}
