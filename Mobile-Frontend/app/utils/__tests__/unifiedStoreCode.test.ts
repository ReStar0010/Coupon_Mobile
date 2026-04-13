import { parseUnifiedStoreCodeFromScan } from '../unifiedStoreCode';

describe('parseUnifiedStoreCodeFromScan', () => {
  it('accepts plain 6 digits', () => {
    expect(parseUnifiedStoreCodeFromScan('123456')).toBe('123456');
  });

  it('strips whitespace', () => {
    expect(parseUnifiedStoreCodeFromScan('  987654  ')).toBe('987654');
  });

  it('reads code from URL query', () => {
    expect(parseUnifiedStoreCodeFromScan('https://example.com/redeem?code=112233')).toBe('112233');
  });

  it('reads 6 digits from path', () => {
    expect(parseUnifiedStoreCodeFromScan('https://coupro.app/store/445566/info')).toBe('445566');
  });

  it('returns null for invalid', () => {
    expect(parseUnifiedStoreCodeFromScan('12')).toBeNull();
    expect(parseUnifiedStoreCodeFromScan('abc')).toBeNull();
  });
});
