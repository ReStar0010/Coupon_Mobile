import {
  parseWebTableQr,
  toWebRedemptionTokenFields,
  isWebTableQrPayload,
} from '../extractWebTableQrPayload';

describe('parseWebTableQr', () => {
  it('parses /w/claim/ token (legacy)', () => {
    expect(parseWebTableQr('https://example.com/w/claim/abc123/')).toEqual({
      kind: 'legacy',
      token: 'abc123',
    });
  });

  it('parses /claim/ without w prefix', () => {
    expect(parseWebTableQr('https://host/claim/xyz/')).toEqual({
      kind: 'legacy',
      token: 'xyz',
    });
  });

  it('parses claim-fixed as fixed session', () => {
    expect(parseWebTableQr('https://example.com/w/claim-fixed/fixedTok/')).toEqual({
      kind: 'fixed',
      token: 'fixedTok',
    });
  });

  it('parses claim-fixed without w prefix', () => {
    expect(parseWebTableQr('https://host/claim-fixed/tok2')).toEqual({
      kind: 'fixed',
      token: 'tok2',
    });
  });

  it('parses claim-fixed path case-insensitively (printed QR / CDNs)', () => {
    expect(
      parseWebTableQr('HTTPS://EXAMPLE.COM/W/CLAIM-FIXED/MyFixedToken/'),
    ).toEqual({ kind: 'fixed', token: 'MyFixedToken' });
  });

  it('parses coupro deep link token query (legacy)', () => {
    expect(parseWebTableQr('coupro://claim?token=hello%2Bworld')).toEqual({
      kind: 'legacy',
      token: 'hello+world',
    });
  });

  it('returns null for unrelated strings', () => {
    expect(parseWebTableQr('123456')).toBeNull();
    expect(parseWebTableQr('random text')).toBeNull();
  });
});

describe('toWebRedemptionTokenFields', () => {
  it('maps legacy to session_token', () => {
    expect(
      toWebRedemptionTokenFields({ kind: 'legacy', token: 't1' }),
    ).toEqual({ session_token: 't1' });
  });

  it('maps fixed to fixed_session_token', () => {
    expect(
      toWebRedemptionTokenFields({ kind: 'fixed', token: 't2' }),
    ).toEqual({ fixed_session_token: 't2' });
  });
});

describe('isWebTableQrPayload', () => {
  it('matches when parseWebTableQr succeeds', () => {
    expect(isWebTableQrPayload('https://x/w/claim/a/')).toBe(true);
    expect(isWebTableQrPayload('plain')).toBe(false);
  });
});
