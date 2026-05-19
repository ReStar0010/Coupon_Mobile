import { compareVersions } from '../semverCompare';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns -1 when the first version is strictly older', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.9', '1.1.0')).toBe(-1);
    expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
  });

  it('returns 1 when the first version is strictly newer', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });

  it('compares each segment numerically, not lexicographically', () => {
    // The classic semver bug: 1.0.10 must be NEWER than 1.0.9.
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
    expect(compareVersions('1.0.9', '1.0.10')).toBe(-1);
  });

  it('treats missing trailing segments as 0', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
  });

  it('treats a pre-release as strictly older than the same clean release', () => {
    // Reviewer-caught regression: an internal TestFlight tester with
    // `nativeApplicationVersion = "1.0.0-rc1"` would previously compare
    // equal to "1.0.0" and skip force-update. A pre-release of the
    // same numeric must sort BELOW the clean release.
    expect(compareVersions('1.0.0-rc1', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0-rc1')).toBe(1);
  });

  it('treats two pre-releases of the same numeric as equal (no rc1 vs rc2 ordering)', () => {
    // Keep the comparator simple — pre-release ordering isn't worth
    // the lines of code for the upgrade-nudge use case.
    expect(compareVersions('1.0.0-rc1', '1.0.0-rc2')).toBe(0);
  });

  it('numeric segments take precedence over pre-release sentinel', () => {
    expect(compareVersions('1.0.0-rc1', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.1', '1.0.0-rc1')).toBe(1);
  });
});
