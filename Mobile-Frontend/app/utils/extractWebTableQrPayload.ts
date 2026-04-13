/**
 * Parse Web consumer table QR payloads (same rules as Web-Frontend /w/scanner extractSessionToken).
 * Used to call POST /api/web/v1/redemptions/ with template_id + session_token or fixed_session_token.
 */

export type WebTableRedemptionBody =
  | { session_token: string; fixed_session_token?: undefined }
  | { fixed_session_token: string; session_token?: undefined };

/** Raw token + kind before mapping to API body fields. */
export type WebTableQrKind = 'legacy' | 'fixed';

export interface ParsedWebTableQr {
  kind: WebTableQrKind;
  token: string;
}

/**
 * Returns true if the string looks like a Web table QR (URL path or coupro deep link with token).
 */
export function isWebTableQrPayload(text: string): boolean {
  return parseWebTableQr(text) !== null;
}

/**
 * Parse table QR into legacy vs fixed session (matches Web scanner ordering).
 */
export function parseWebTableQr(text: string): ParsedWebTableQr | null {
  const s = text.trim();

  const fixedMatch = s.match(/\/(?:w\/)?claim-fixed\/([^/?#]+)\/?/i);
  if (fixedMatch?.[1]) {
    return { kind: 'fixed', token: fixedMatch[1] };
  }

  const legacyMatch = s.match(/\/(?:w\/)?claim\/([^/?#]+)\/?/i);
  if (legacyMatch?.[1]) {
    return { kind: 'legacy', token: legacyMatch[1] };
  }

  const queryToken = s.match(/[?&]token=([^&#]+)/i);
  if (queryToken?.[1]) {
    return { kind: 'legacy', token: decodeURIComponent(queryToken[1]) };
  }

  return null;
}

/**
 * Build POST /web/v1/redemptions/ body fields (exactly one of session_token | fixed_session_token).
 */
export function toWebRedemptionTokenFields(parsed: ParsedWebTableQr): WebTableRedemptionBody {
  if (parsed.kind === 'fixed') {
    return { fixed_session_token: parsed.token };
  }
  return { session_token: parsed.token };
}
