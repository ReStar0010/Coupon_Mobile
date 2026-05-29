/**
 * Tests for the feature-flag wrapper. Mirrors the posthog wrapper's
 * three-guarantee contract: silent no-op without key, never throws,
 * single source of truth.
 */

const mockGetFeatureFlag = jest.fn();

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    getFeatureFlag: mockGetFeatureFlag,
  })),
}));

function loadModule(extra: Record<string, unknown>): typeof import('../flags') {
  let mod!: typeof import('../flags');
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra } },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../flags');
  });
  return mod;
}

describe('analytics/flags (merchant)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the fallback when no API key is configured', () => {
    const { getFlag } = loadModule({});
    expect(getFlag('merchant_compose_variant', 'default')).toBe('default');
    expect(mockGetFeatureFlag).not.toHaveBeenCalled();
  });

  it('returns the live flag value when key is present', () => {
    mockGetFeatureFlag.mockReturnValue('redesign');
    const { getFlag } = loadModule({ posthogApiKey: 'phc' });
    expect(getFlag('merchant_compose_variant', 'default')).toBe('redesign');
    expect(mockGetFeatureFlag).toHaveBeenCalledWith('merchant_compose_variant');
  });

  it('returns the fallback when PostHog returns undefined (flag not loaded yet)', () => {
    mockGetFeatureFlag.mockReturnValue(undefined);
    const { getFlag } = loadModule({ posthogApiKey: 'phc' });
    expect(getFlag('merchant_compose_variant', 'default')).toBe('default');
  });

  it('returns the fallback when PostHog throws', () => {
    mockGetFeatureFlag.mockImplementationOnce(() => {
      throw new Error('flag service down');
    });
    const { getFlag } = loadModule({ posthogApiKey: 'phc' });
    expect(getFlag('merchant_compose_variant', 'default')).toBe('default');
  });

  it('boolean flags work the same way (true/false/undefined)', () => {
    mockGetFeatureFlag.mockReturnValue(true);
    const { getFlag } = loadModule({ posthogApiKey: 'phc' });
    expect(getFlag('session_replay_enabled', false)).toBe(true);
  });
});
