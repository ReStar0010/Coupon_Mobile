/**
 * Parse a deep link URL into a typed result.
 *
 * Handles all formats delivered to the app:
 *  - Query:  coupro://collection?token=<t>       (native share sheet)
 *  - Path:   coupro://collection/<t>              (Smart App Banner, 2nd tap)
 *  - Path:   coupro:///collection/<t>             (Smart App Banner, 1st tap — empty authority)
 *  - HTTPS:  https://api.coupro.pro/collection/<t>  (iOS Universal Link / Android App Link)
 *  - HTTPS:  https://app.coupro.pro/collection/<t>  (alternate host)
 *  - Voucher: coupro://platform-voucher?token=<t> and https://.../voucher/<t>
 *  - Claim:  coupro://claim?token=<t> and https://.../claim/<t>
 */
export function parseDeepLinkUrl(
  url: string | null,
): { type: 'claim' | 'collection' | 'voucher'; token: string } | null {
  if (!url || typeof url !== 'string') return null;
  const s = url.trim();

  // Query-style (custom scheme)
  const claimQuery = /^coupro:\/\/claim\?(?:.*&)?token=([^&]+)/i.exec(s);
  if (claimQuery) return { type: 'claim', token: claimQuery[1] };
  const collectionQuery = /^coupro:\/\/collection\?(?:.*&)?token=([^&]+)/i.exec(s);
  if (collectionQuery) return { type: 'collection', token: collectionQuery[1] };
  const voucherQuery = /^coupro:\/\/platform-voucher\?(?:.*&)?token=([^&]+)/i.exec(s);
  if (voucherQuery) return { type: 'voucher', token: voucherQuery[1] };

  // Path-style (custom scheme + HTTPS Universal/App Links)
  const claimPath = /\/claim\/([^/?]+)/i.exec(s);
  if (claimPath) return { type: 'claim', token: claimPath[1] };
  const collectionPath = /\/collection\/([^/?]+)/i.exec(s);
  if (collectionPath) return { type: 'collection', token: collectionPath[1] };
  const voucherPath = /\/voucher\/([^/?]+)/i.exec(s);
  if (voucherPath) return { type: 'voucher', token: voucherPath[1] };

  return null;
}
