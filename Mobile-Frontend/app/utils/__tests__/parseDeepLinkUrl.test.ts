import { parseDeepLinkUrl } from '../parseDeepLinkUrl';

// ---------------------------------------------------------------------------
// collection links
// ---------------------------------------------------------------------------
describe('collection links', () => {
  it('parses coupro:// query-style (native share sheet)', () => {
    expect(parseDeepLinkUrl('coupro://collection?token=abc123')).toEqual({
      type: 'collection',
      token: 'abc123',
    });
  });

  it('parses coupro:// query-style with extra params before token', () => {
    expect(parseDeepLinkUrl('coupro://collection?foo=bar&token=abc123')).toEqual({
      type: 'collection',
      token: 'abc123',
    });
  });

  it('parses coupro:// path-style (Smart App Banner 2nd tap)', () => {
    expect(parseDeepLinkUrl('coupro://collection/abc123')).toEqual({
      type: 'collection',
      token: 'abc123',
    });
  });

  it('parses coupro:/// path-style (Smart App Banner 1st tap — empty authority)', () => {
    expect(parseDeepLinkUrl('coupro:///collection/abc123')).toEqual({
      type: 'collection',
      token: 'abc123',
    });
  });

  it('parses https://api.coupro.pro Universal/App Link', () => {
    expect(parseDeepLinkUrl('https://api.coupro.pro/collection/tok-xyz')).toEqual({
      type: 'collection',
      token: 'tok-xyz',
    });
  });

  it('parses https://app.coupro.pro App Link (alternate host)', () => {
    expect(parseDeepLinkUrl('https://app.coupro.pro/collection/tok-xyz')).toEqual({
      type: 'collection',
      token: 'tok-xyz',
    });
  });
});

// ---------------------------------------------------------------------------
// claim links
// ---------------------------------------------------------------------------
describe('claim links', () => {
  it('parses coupro://claim query-style', () => {
    expect(parseDeepLinkUrl('coupro://claim?token=claimTok')).toEqual({
      type: 'claim',
      token: 'claimTok',
    });
  });

  it('parses https://api.coupro.pro/claim/ App Link', () => {
    expect(parseDeepLinkUrl('https://api.coupro.pro/claim/claimTok')).toEqual({
      type: 'claim',
      token: 'claimTok',
    });
  });

  it('does NOT match /claim-fixed/ as a claim link', () => {
    // /claim-fixed/ is a separate flow; the regex /\/claim\// should not match it
    const result = parseDeepLinkUrl('https://api.coupro.pro/claim-fixed/fixedTok');
    expect(result?.type).not.toBe('claim');
  });
});

// ---------------------------------------------------------------------------
// voucher links
// ---------------------------------------------------------------------------
describe('voucher links', () => {
  it('parses coupro://platform-voucher query-style', () => {
    expect(parseDeepLinkUrl('coupro://platform-voucher?token=voucherTok')).toEqual({
      type: 'voucher',
      token: 'voucherTok',
    });
  });

  it('parses https://api.coupro.pro/voucher/ App Link', () => {
    expect(parseDeepLinkUrl('https://api.coupro.pro/voucher/voucherTok')).toEqual({
      type: 'voucher',
      token: 'voucherTok',
    });
  });
});

// ---------------------------------------------------------------------------
// edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('returns null for null input', () => {
    expect(parseDeepLinkUrl(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDeepLinkUrl('')).toBeNull();
  });

  it('returns null for unrelated URL', () => {
    expect(parseDeepLinkUrl('https://google.com')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(parseDeepLinkUrl('hello world')).toBeNull();
  });

  it('trims leading/trailing whitespace before parsing', () => {
    expect(parseDeepLinkUrl('  coupro://collection?token=trimmed  ')).toEqual({
      type: 'collection',
      token: 'trimmed',
    });
  });

  it('is case-insensitive for the scheme and path', () => {
    expect(parseDeepLinkUrl('HTTPS://API.COUPRO.PRO/COLLECTION/tok123')).toEqual({
      type: 'collection',
      token: 'tok123',
    });
  });

  it('preserves URL-encoded characters in the token', () => {
    // Token value is preserved raw; caller decides whether to decode
    expect(parseDeepLinkUrl('coupro://collection?token=abc%2Bdef')).toEqual({
      type: 'collection',
      token: 'abc%2Bdef',
    });
  });
});
