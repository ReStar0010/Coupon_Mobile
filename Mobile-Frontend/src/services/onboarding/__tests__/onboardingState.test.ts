/**
 * Tests for the onboarding-state service. Two surfaces:
 *   1. Launch onboarding ("have you ever seen the 3-page intro?")
 *   2. Per-screen coach-marks ("have you ever seen the coach mark for X?")
 *
 * Both are AsyncStorage-backed, version-suffixed so bumping the suffix
 * re-shows the flow on the next release without erasing user state.
 *
 * The service must:
 *   - Return false when the key is missing (default = not seen).
 *   - Return true after `markSeen()` resolves.
 *   - Never throw — AsyncStorage failures degrade to "not seen" which
 *     causes us to over-show, which is safer than crashing the gate.
 */

const mockGetItem = jest.fn<Promise<string | null>, [string]>();
const mockSetItem = jest.fn<Promise<void>, [string, string]>();
const mockRemoveItem = jest.fn<Promise<void>, [string]>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => mockGetItem(k),
    setItem: (k: string, v: string) => mockSetItem(k, v),
    removeItem: (k: string) => mockRemoveItem(k),
  },
}));

import {
  hasSeenLaunchOnboarding,
  markLaunchOnboardingSeen,
  hasSeenCoachmark,
  markCoachmarkSeen,
  resetAllCoachmarks,
  resetLaunchOnboarding,
  resetAllOnboarding,
  COACHMARK_KEYS,
} from '../onboardingState';

describe('onboardingState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  describe('launch onboarding', () => {
    it('hasSeenLaunchOnboarding returns false when the flag is missing', async () => {
      mockGetItem.mockResolvedValueOnce(null);
      await expect(hasSeenLaunchOnboarding()).resolves.toBe(false);
    });

    it('returns true once markLaunchOnboardingSeen has run', async () => {
      mockGetItem.mockResolvedValueOnce('1');
      await expect(hasSeenLaunchOnboarding()).resolves.toBe(true);
    });

    it('markLaunchOnboardingSeen writes "1" under a versioned key', async () => {
      await markLaunchOnboardingSeen();
      expect(mockSetItem).toHaveBeenCalledTimes(1);
      const [key, value] = mockSetItem.mock.calls[0];
      expect(key).toMatch(/^onboarding_v\d+_seen$/);
      expect(value).toBe('1');
    });

    it('degrades to "not seen" if AsyncStorage throws', async () => {
      mockGetItem.mockRejectedValueOnce(new Error('storage offline'));
      await expect(hasSeenLaunchOnboarding()).resolves.toBe(false);
    });
  });

  describe('coach-marks', () => {
    it('hasSeenCoachmark("home") returns false when missing', async () => {
      mockGetItem.mockResolvedValueOnce(null);
      await expect(hasSeenCoachmark('home')).resolves.toBe(false);
    });

    it('markCoachmarkSeen("map") writes under a scoped key', async () => {
      await markCoachmarkSeen('map');
      const [key, value] = mockSetItem.mock.calls[0];
      expect(key).toMatch(/^coach_v\d+_map$/);
      expect(value).toBe('1');
    });

    it('resetAllCoachmarks removes every known key (dev affordance)', async () => {
      await resetAllCoachmarks();
      expect(mockRemoveItem).toHaveBeenCalledTimes(COACHMARK_KEYS.length);
    });

    it('hasSeenCoachmark never throws — falls back to "not seen"', async () => {
      mockGetItem.mockRejectedValueOnce(new Error('storage offline'));
      await expect(hasSeenCoachmark('spinner')).resolves.toBe(false);
    });
  });

  describe('reset for replay', () => {
    it('resetLaunchOnboarding removes the versioned launch key', async () => {
      await resetLaunchOnboarding();
      expect(mockRemoveItem).toHaveBeenCalledTimes(1);
      expect(mockRemoveItem.mock.calls[0][0]).toMatch(/^onboarding_v\d+_seen$/);
    });

    it('resetAllOnboarding clears the launch flag AND every coach-mark', async () => {
      await resetAllOnboarding();
      // launch key + one per coach-mark screen
      expect(mockRemoveItem).toHaveBeenCalledTimes(COACHMARK_KEYS.length + 1);
      const keys = mockRemoveItem.mock.calls.map((c) => c[0]);
      expect(keys.some((k) => /^onboarding_v\d+_seen$/.test(k))).toBe(true);
      for (const screen of COACHMARK_KEYS) {
        expect(keys.some((k) => k === `coach_v1_${screen}`)).toBe(true);
      }
    });

    it('resetLaunchOnboarding never throws on storage failure', async () => {
      mockRemoveItem.mockRejectedValueOnce(new Error('storage offline'));
      await expect(resetLaunchOnboarding()).resolves.toBeUndefined();
    });
  });
});
