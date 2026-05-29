/**
 * Tests for the EAS Update launch-time apply helper.
 *
 * Contract:
 *   - On a healthy network it checks, downloads, and triggers a reload.
 *   - On no update available it returns 'no-update' without reloading.
 *   - On a slow network (deadline exceeded) it returns 'timed-out' and
 *     does NOT call reloadAsync. The user opens the app immediately.
 *   - It never throws — any unexpected error returns 'error'.
 *   - When Updates.isEnabled is false (Expo Go / dev), it short-circuits
 *     to 'disabled' and never touches the network.
 */

const mockIsEnabled = { value: true };
const mockCheckForUpdate = jest.fn();
const mockFetchUpdate = jest.fn();
const mockReload = jest.fn();

jest.mock('expo-updates', () => ({
  __esModule: true,
  get isEnabled() {
    return mockIsEnabled.value;
  },
  checkForUpdateAsync: () => mockCheckForUpdate(),
  fetchUpdateAsync: () => mockFetchUpdate(),
  reloadAsync: () => mockReload(),
}));

import { tryApplyUpdate } from '../applyUpdates';

describe('tryApplyUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEnabled.value = true;
    mockReload.mockResolvedValue(undefined);
  });

  it('short-circuits to "disabled" when Updates.isEnabled is false', async () => {
    mockIsEnabled.value = false;
    const result = await tryApplyUpdate({ deadlineMs: 1000 });
    expect(result).toBe('disabled');
    expect(mockCheckForUpdate).not.toHaveBeenCalled();
  });

  it('returns "no-update" when the server reports nothing to fetch', async () => {
    mockCheckForUpdate.mockResolvedValue({ isAvailable: false });
    const result = await tryApplyUpdate({ deadlineMs: 1000 });
    expect(result).toBe('no-update');
    expect(mockFetchUpdate).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('downloads + reloads when an update is available', async () => {
    mockCheckForUpdate.mockResolvedValue({ isAvailable: true });
    mockFetchUpdate.mockResolvedValue({ isNew: true });
    const result = await tryApplyUpdate({ deadlineMs: 5000 });
    expect(result).toBe('reloading');
    expect(mockFetchUpdate).toHaveBeenCalledTimes(1);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('returns "timed-out" if the deadline elapses before the chain resolves', async () => {
    jest.useFakeTimers();
    try {
      // Never-resolving check simulates a hung network.
      mockCheckForUpdate.mockImplementation(() => new Promise(() => undefined));
      const resultP = tryApplyUpdate({ deadlineMs: 5000 });
      await jest.advanceTimersByTimeAsync(5100);
      await expect(resultP).resolves.toBe('timed-out');
      expect(mockReload).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns "error" — never throws — when the SDK throws unexpectedly', async () => {
    mockCheckForUpdate.mockRejectedValue(new Error('boom'));
    await expect(tryApplyUpdate({ deadlineMs: 1000 })).resolves.toBe('error');
    expect(mockReload).not.toHaveBeenCalled();
  });
});
