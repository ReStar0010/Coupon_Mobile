/**
 * Tests for the PostHog wrapper. The wrapper must:
 *   - No-op silently when no API key is configured (dev builds, CI).
 *   - Strip PII fields (email, phone, password, token) from event props.
 *   - Identify / reset users on auth state changes.
 *   - Never throw if the underlying client fails — analytics must never
 *     break the app.
 */

const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockReset = jest.fn();
const mockGetFeatureFlag = jest.fn();
const mockReloadFeatureFlagsAsync = jest.fn(() => Promise.resolve());

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  PostHog: jest.fn().mockImplementation(() => ({
    capture: mockCapture,
    identify: mockIdentify,
    reset: mockReset,
    getFeatureFlag: mockGetFeatureFlag,
    reloadFeatureFlagsAsync: mockReloadFeatureFlagsAsync,
  })),
}));

function loadModule(extra: Record<string, unknown>): typeof import('../posthog') {
  let mod!: typeof import('../posthog');
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra } },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../posthog');
  });
  return mod;
}

describe('analytics/posthog wrapper (merchant)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('without an API key', () => {
    it('track() is a no-op and does not throw', () => {
      const { track } = loadModule({});
      expect(() => track('test_event')).not.toThrow();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('identify() and reset() are no-ops', () => {
      const { identify, reset } = loadModule({});
      identify('u-1', { displayName: 'Kayne' });
      reset();
      expect(mockIdentify).not.toHaveBeenCalled();
      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  describe('with an API key', () => {
    function withKey(): typeof import('../posthog') {
      return loadModule({
        posthogApiKey: 'phc_test_key',
        posthogHost: 'https://us.i.posthog.com',
      });
    }

    it('track() forwards event name and props to PostHog.capture', () => {
      const { track } = withKey();
      track('merchant.coupon_created', { templateId: 'c-1', source: 'compose' });
      expect(mockCapture).toHaveBeenCalledWith(
        'merchant.coupon_created',
        expect.objectContaining({ templateId: 'c-1', source: 'compose' }),
      );
    });

    it('track() strips PII fields (email, phone, password, token, refresh_token)', () => {
      const { track } = withKey();
      track('auth.login_completed', {
        email: 'user@example.com',
        phone: '0912345678',
        password: 'secret',
        token: 'jwt-access',
        refresh_token: 'jwt-refresh',
        userId: 'u-7',
      });
      const [, props] = mockCapture.mock.calls[0];
      expect(props).not.toHaveProperty('email');
      expect(props).not.toHaveProperty('phone');
      expect(props).not.toHaveProperty('password');
      expect(props).not.toHaveProperty('token');
      expect(props).not.toHaveProperty('refresh_token');
      expect(props.userId).toBe('u-7');
    });

    it('strips PII recursively from nested objects', () => {
      const { track } = withKey();
      track('debug.dump', {
        templateId: 'c-1',
        user: { id: 'u-9', email: 'leak@me.com', phone: '0900000000' },
        meta: { actor: { token: 'jwt' } },
      });
      const [, props] = mockCapture.mock.calls[0];
      expect(props.templateId).toBe('c-1');
      expect(props.user).toBeDefined();
      expect((props.user as Record<string, unknown>).id).toBe('u-9');
      expect(props.user).not.toHaveProperty('email');
      expect(props.user).not.toHaveProperty('phone');
      expect((props.meta as Record<string, unknown>).actor).toEqual({});
    });

    it('strips PII inside arrays of objects', () => {
      const { track } = withKey();
      track('debug.dump', {
        members: [
          { id: 'a', email: 'a@x.com' },
          { id: 'b', phone: '0911111111' },
        ],
      });
      const [, props] = mockCapture.mock.calls[0];
      const members = props.members as Array<Record<string, unknown>>;
      expect(members[0]).toEqual({ id: 'a' });
      expect(members[1]).toEqual({ id: 'b' });
    });

    it('identify() forwards userId and PII-stripped traits', () => {
      const { identify } = withKey();
      identify('u-9', { displayName: 'CoKayne', email: 'leak@me.com' });
      expect(mockIdentify).toHaveBeenCalledTimes(1);
      const [userId, traits] = mockIdentify.mock.calls[0];
      expect(userId).toBe('u-9');
      expect(traits).toEqual({ displayName: 'CoKayne' });
    });

    it('identify() triggers a flag refresh so post-login A/B bucketing updates immediately', async () => {
      const { identify } = withKey();
      identify('u-7', { displayName: 'CoKayne' });
      expect(mockReloadFeatureFlagsAsync).toHaveBeenCalledTimes(1);
      await Promise.resolve();
    });

    it('identify() never throws when reloadFeatureFlagsAsync rejects', async () => {
      mockReloadFeatureFlagsAsync.mockImplementationOnce(() =>
        Promise.reject(new Error('flags down')),
      );
      const { identify } = withKey();
      expect(() => identify('u-8')).not.toThrow();
      await Promise.resolve();
    });

    it('reset() calls underlying client.reset', () => {
      const { reset } = withKey();
      reset();
      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it('track() never throws when the client throws', () => {
      mockCapture.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const { track } = withKey();
      expect(() => track('any')).not.toThrow();
    });
  });

  describe('session replay', () => {
    it('does NOT enable session replay by default (must be opted into via app.json)', () => {
      const { PostHog: PostHogCtor } = jest.requireMock('posthog-react-native');
      (PostHogCtor as jest.Mock).mockClear();
      const { track } = loadModule({ posthogApiKey: 'phc' });
      track('foo');
      const lastCall = (PostHogCtor as jest.Mock).mock.calls.at(-1);
      expect(lastCall?.[1]?.enableSessionReplay).toBe(false);
    });

    it('enables session replay when posthogSessionReplay=true with input + image masking on', () => {
      const { PostHog: PostHogCtor } = jest.requireMock('posthog-react-native');
      (PostHogCtor as jest.Mock).mockClear();
      const { track } = loadModule({
        posthogApiKey: 'phc',
        posthogSessionReplay: true,
      });
      track('foo');
      const lastCall = (PostHogCtor as jest.Mock).mock.calls.at(-1);
      expect(lastCall?.[1]?.enableSessionReplay).toBe(true);
      expect(lastCall?.[1]?.sessionReplayConfig?.maskAllTextInputs).toBe(true);
      // Merchant images may include store-internal screenshots — keep masked.
      expect(lastCall?.[1]?.sessionReplayConfig?.maskAllImages).toBe(true);
    });
  });
});
