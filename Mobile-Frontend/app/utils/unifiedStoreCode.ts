/**
 * Parse a 6-digit store unified redemption code from QR/barcode scan text.
 * Supports: plain "123456", URLs with ?code=123456 or &code=123456, or embedded 6 digits.
 */
const SIX_DIGITS = /^(\d{6})$/;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * Returns normalized 6-digit code or null if none can be resolved unambiguously.
 */
export function parseUnifiedStoreCodeFromScan(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (SIX_DIGITS.test(trimmed)) {
    return trimmed;
  }

  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes('://')) {
      const u = new URL(trimmed);
      const fromQuery =
        u.searchParams.get('code') ??
        u.searchParams.get('redeem_code') ??
        u.searchParams.get('unified') ??
        u.searchParams.get('store_code');
      if (fromQuery && SIX_DIGITS.test(fromQuery.trim())) {
        return fromQuery.trim();
      }
      const pathMatch = u.pathname.match(/(\d{6})(?:\/?|$)/);
      if (pathMatch && SIX_DIGITS.test(pathMatch[1])) {
        return pathMatch[1];
      }
    }
  } catch {
    // Not a valid URL — fall through to heuristics below
  }

  const allDigits = digitsOnly(trimmed);
  if (allDigits.length === 6) {
    return allDigits;
  }

  // Single 6-digit run inside longer digit strings (e.g. padded payloads)
  const runMatch = trimmed.match(/(?:^|\D)(\d{6})(?:\D|$)/);
  if (runMatch && SIX_DIGITS.test(runMatch[1])) {
    return runMatch[1];
  }

  return null;
}
