/**
 * Heading-update predicate for the map's "you are here" marker.
 *
 * Background: `Location.watchHeadingAsync` fires at ~10 Hz on iOS, less
 * on Android. Pushing every reading through React state would re-render
 * the entire MapScreen subtree 10× per second for changes that are
 * imperceptible to the user (< 1° rotation is below the human
 * perception threshold for casual phone rotation).
 *
 * Behaviour:
 *   - First non-null reading after a null → always emit (so the cone
 *     appears the instant the compass calibrates).
 *   - null → number, number → null → always emit (uncalibrated state
 *     transitions must be reflected immediately, never stale).
 *   - number → number with |delta| < 1° → suppress.
 *   - number → number with |delta| ≥ 1° → emit.
 *
 * Kept as a pure function (rather than inlined in MapScreen's
 * useEffect closure) so it can be unit-tested without spinning up the
 * whole screen + the expo-location mock chain. The MapScreen watcher
 * imports it and calls it before each setUserHeading.
 */
export function shouldUpdateHeading(prev: number | null, next: number | null): boolean {
  if (next !== null && prev !== null && Math.abs(next - prev) < 1) {
    return false;
  }
  return true;
}
