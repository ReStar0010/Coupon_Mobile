/**
 * Tests for the Sentry breadcrumb URL scrubber.
 *
 * Risk this guards against: the spinner co-op WebSocket auth puts JWT
 * tokens in `?token=…` query strings (see api/spinner_coop/consumer.py
 * for why — browser WebSocket API can't send headers). By default
 * @sentry/react-native captures fetch/xhr/WS URLs as breadcrumbs
 * verbatim, which would ship the token straight to Sentry. The
 * scrubber strips known-sensitive params before any breadcrumb leaves
 * the device.
 */

import { scrubBreadcrumb, scrubUrl, SENSITIVE_PARAM_KEYS } from '../scrubBreadcrumb';

describe('scrubUrl', () => {
  it('returns the URL unchanged when no query string is present', () => {
    expect(scrubUrl('https://api.example.com/ws/spinner/v1/')).toBe(
      'https://api.example.com/ws/spinner/v1/',
    );
  });

  it('redacts the token query param while preserving the rest of the URL', () => {
    const out = scrubUrl('https://api.example.com/ws/spinner/v1/?token=eyJhbGciOi.payload.sig');
    expect(out).not.toContain('eyJhbGciOi');
    expect(out).toContain('token=[REDACTED]');
    expect(out).toContain('/ws/spinner/v1/');
  });

  it('redacts every known sensitive key', () => {
    const url =
      'https://api.example.com/x?token=abc&access_token=def&refresh_token=ghi&password=jkl&foo=keep';
    const out = scrubUrl(url);
    for (const key of SENSITIVE_PARAM_KEYS) {
      // Each sensitive key's VALUE must be redacted.
      expect(out).not.toMatch(new RegExp(`${key}=(?!\\[REDACTED\\])`));
    }
    // Non-sensitive params survive.
    expect(out).toContain('foo=keep');
  });

  it('is case-insensitive on the param key', () => {
    const out = scrubUrl('https://api.example.com/x?Token=abc&ACCESS_TOKEN=def');
    expect(out).not.toContain('abc');
    expect(out).not.toContain('def');
    expect(out).toContain('[REDACTED]');
  });

  it('preserves the URL fragment', () => {
    const out = scrubUrl('https://api.example.com/x?token=abc#section');
    expect(out).toContain('#section');
    expect(out).toContain('[REDACTED]');
  });

  it('returns the input unchanged for non-URL strings (never throws)', () => {
    // Some breadcrumbs put method+path in `data.url` without a host
    // ("GET /api/x?token=abc"). The scrubber must handle that.
    const out = scrubUrl('GET /api/x?token=abc');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('abc');
  });

  it('returns the input unchanged for empty / invalid strings', () => {
    expect(scrubUrl('')).toBe('');
    expect(scrubUrl('not a url at all')).toBe('not a url at all');
  });
});

describe('scrubBreadcrumb', () => {
  it('returns null breadcrumbs untouched', () => {
    expect(scrubBreadcrumb(null as unknown as Record<string, unknown>)).toBeNull();
  });

  it('scrubs the breadcrumb top-level `data.url` field', () => {
    const out = scrubBreadcrumb({
      category: 'xhr',
      data: { url: 'https://api.example.com/x?token=secret' },
    });
    expect(out).not.toBeNull();
    const data = (out as { data: { url: string } }).data;
    expect(data.url).toContain('[REDACTED]');
    expect(data.url).not.toContain('secret');
  });

  it('scrubs `data.from` and `data.to` (used by navigation breadcrumbs)', () => {
    const out = scrubBreadcrumb({
      category: 'navigation',
      data: {
        from: 'https://example.com/a?token=AAA',
        to: 'https://example.com/b?token=BBB',
      },
    });
    const data = (out as { data: { from: string; to: string } }).data;
    expect(data.from).not.toContain('AAA');
    expect(data.to).not.toContain('BBB');
  });

  it('passes through breadcrumbs without sensitive data unchanged', () => {
    const input = {
      category: 'console',
      message: 'hello',
      data: { args: ['some', 'log', 'args'] },
    };
    const out = scrubBreadcrumb(input);
    expect(out).toEqual(input);
  });

  it('scrubs sensitive params embedded in the top-level `message` field', () => {
    // RN network layer often attaches the full URL as a human-readable
    // breadcrumb message ("WebSocket open: wss://…?token=…") separate
    // from `data.url`. Both must be scrubbed.
    const out = scrubBreadcrumb({
      category: 'network',
      message: 'WebSocket open: wss://api.example.com/ws/?token=SECRET_JWT',
    });
    const msg = (out as { message: string }).message;
    expect(msg).not.toContain('SECRET_JWT');
    expect(msg).toContain('[REDACTED]');
    expect(msg).toContain('WebSocket open');
  });

  it('leaves the message field unchanged when it contains no sensitive params', () => {
    const input = {
      category: 'log',
      message: 'Spinner draw completed in 1200ms',
    };
    const out = scrubBreadcrumb(input);
    expect((out as { message: string }).message).toBe(input.message);
  });

  it('never mutates the input breadcrumb', () => {
    // Defensive: Sentry's contract is that beforeBreadcrumb returns the
    // mutated copy; mutating the input would surprise other handlers.
    const input = {
      category: 'xhr',
      data: { url: 'https://example.com/x?token=secret' },
    };
    const before = JSON.stringify(input);
    scrubBreadcrumb(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
