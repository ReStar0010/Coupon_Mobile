import { MAX_DEAD_RECKON_MS, allFullyCharged, interpolateLocalCharge } from '../charge';

describe('interpolateLocalCharge', () => {
  it('returns the server value when not charging', () => {
    expect(
      interpolateLocalCharge({
        serverProgress: 0.4,
        isCharging: false,
        pressedAtMs: null,
        nowMs: 1000,
      }),
    ).toBeCloseTo(0.4);
  });

  it('returns the server value when pressedAtMs is null', () => {
    expect(
      interpolateLocalCharge({
        serverProgress: 0.6,
        isCharging: true,
        pressedAtMs: null,
        nowMs: 1000,
      }),
    ).toBeCloseTo(0.6);
  });

  it('extrapolates forward from the press timestamp at the given duration', () => {
    // 50ms past press, duration 2500ms → +0.02 above the server value
    const result = interpolateLocalCharge({
      serverProgress: 0.4,
      isCharging: true,
      pressedAtMs: 1000,
      nowMs: 1050,
      durationMs: 2500,
    });
    expect(result).toBeCloseTo(0.42, 4);
  });

  it('caps dead-reckoning at MAX_DEAD_RECKON_MS so it cannot drift unboundedly', () => {
    // Server says 0.4, but we've been pressing for 5 full seconds
    const result = interpolateLocalCharge({
      serverProgress: 0.4,
      isCharging: true,
      pressedAtMs: 1000,
      nowMs: 1000 + 5000, // way past
      durationMs: 2500,
    });
    // Cap at +MAX/duration above server
    const expectedMax = 0.4 + MAX_DEAD_RECKON_MS / 2500;
    expect(result).toBeCloseTo(expectedMax, 4);
  });

  it('clamps the final value to 1.0', () => {
    const result = interpolateLocalCharge({
      serverProgress: 0.99,
      isCharging: true,
      pressedAtMs: 0,
      nowMs: 100,
      durationMs: 2500,
    });
    expect(result).toBeLessThanOrEqual(1);
  });

  it('treats elapsed < 0 as 0', () => {
    const result = interpolateLocalCharge({
      serverProgress: 0.3,
      isCharging: true,
      pressedAtMs: 2000,
      nowMs: 1000, // pressedAt is in the future (clock skew)
      durationMs: 2500,
    });
    expect(result).toBeCloseTo(0.3, 4);
  });

  it('clamps server progress into [0,1] before extrapolating', () => {
    const result = interpolateLocalCharge({
      serverProgress: -0.5,
      isCharging: false,
      pressedAtMs: null,
      nowMs: 0,
    });
    expect(result).toBe(0);
  });
});

describe('allFullyCharged', () => {
  it('false on empty list', () => {
    expect(allFullyCharged([])).toBe(false);
  });

  it('false if any value < 1', () => {
    expect(allFullyCharged([1, 1, 0.99])).toBe(false);
  });

  it('true if every value >= 1', () => {
    expect(allFullyCharged([1, 1, 1])).toBe(true);
    expect(allFullyCharged([1.0, 1.5])).toBe(true);
  });
});
