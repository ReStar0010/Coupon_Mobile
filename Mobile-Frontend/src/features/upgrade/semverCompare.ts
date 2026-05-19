/**
 * Compare two dotted version strings (e.g. "1.0.10" vs "1.0.9").
 * Returns -1 / 0 / 1 per `Array.prototype.sort` convention.
 *
 * Why not the `semver` package: ~25 KB minified + only used in two
 * call sites (force-update + recommended-update). Hand-rolled keeps
 * the bundle tight and the behaviour predictable.
 *
 * Contract for the upgrade-nudge case:
 *   - Numeric per-segment comparison so 1.0.10 > 1.0.9 (not lexicographic).
 *   - Missing trailing segments treated as 0 ("1.0" === "1.0.0").
 *   - Pre-release tiebreaker: when numerics are equal, a clean release
 *     (no `-` suffix) is NEWER than any pre-release of the same numeric.
 *     This prevents an internal TestFlight build "1.0.0-rc1" from
 *     comparing equal to the released "1.0.0" and silently skipping
 *     a force-update floor of "1.0.0".
 *   - Pre-releases of the same numeric compare equal (we don't try to
 *     order rc1 vs rc2 — the upgrade-nudge surface doesn't need it).
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const partsA = numericParts(a);
  const partsB = numericParts(b);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const av = partsA[i] ?? 0;
    const bv = partsB[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  // Numeric parts are equal — pre-release tiebreaker.
  const aPre = hasPreRelease(a);
  const bPre = hasPreRelease(b);
  if (aPre && !bPre) return -1;
  if (!aPre && bPre) return 1;
  return 0;
}

function numericParts(v: string): number[] {
  // Strip everything from the first `-` onwards (pre-release / build
  // metadata per semver) before splitting on `.`.
  const main = v.split('-')[0] ?? v;
  return main.split('.').map((seg) => {
    const n = parseInt(seg, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

function hasPreRelease(v: string): boolean {
  return v.includes('-');
}
