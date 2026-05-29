/**
 * Tests for the heading-update predicate. This guards the ≥1° throttle
 * that keeps `Location.watchHeadingAsync` from re-rendering MapScreen
 * 10× per second for imperceptible deltas.
 */
import { shouldUpdateHeading } from '../heading';

describe('shouldUpdateHeading', () => {
  it('first non-null reading after null is always emitted', () => {
    expect(shouldUpdateHeading(null, 0)).toBe(true);
    expect(shouldUpdateHeading(null, 90)).toBe(true);
    expect(shouldUpdateHeading(null, 359)).toBe(true);
  });

  it('null → null is emitted (no-op for React but predicate stays simple)', () => {
    // The predicate intentionally falls through on null↔null. setState
    // of the same null is a React no-op so this is harmless and keeps
    // the predicate composition obvious.
    expect(shouldUpdateHeading(null, null)).toBe(true);
  });

  it('number → null is emitted (compass became uncalibrated)', () => {
    expect(shouldUpdateHeading(42, null)).toBe(true);
    expect(shouldUpdateHeading(0, null)).toBe(true);
  });

  it('suppresses sub-1° deltas (the hot path the throttle exists for)', () => {
    expect(shouldUpdateHeading(42.0, 42.5)).toBe(false);
    expect(shouldUpdateHeading(42.5, 42.0)).toBe(false);
    expect(shouldUpdateHeading(42.0, 42.99)).toBe(false);
    expect(shouldUpdateHeading(42.0, 42.0)).toBe(false);
  });

  it('emits deltas of exactly 1° (boundary)', () => {
    expect(shouldUpdateHeading(42.0, 43.0)).toBe(true);
    expect(shouldUpdateHeading(43.0, 42.0)).toBe(true);
  });

  it('emits larger deltas', () => {
    expect(shouldUpdateHeading(0, 5)).toBe(true);
    expect(shouldUpdateHeading(180, 270)).toBe(true);
    expect(shouldUpdateHeading(359, 0)).toBe(true); // wrap-around still emits
  });

  it('treats abs delta symmetrically (CW vs CCW)', () => {
    expect(shouldUpdateHeading(10, 11)).toBe(true);
    expect(shouldUpdateHeading(11, 10)).toBe(true);
    expect(shouldUpdateHeading(10, 10.4)).toBe(false);
    expect(shouldUpdateHeading(10.4, 10)).toBe(false);
  });
});
