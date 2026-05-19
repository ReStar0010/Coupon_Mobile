import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockGetVersionInfo = jest.fn();
jest.mock('@/src/services/api/appVersion', () => ({
  getVersionInfo: () => mockGetVersionInfo(),
}));

const mockNativeVersion = { current: '1.0.0' };
jest.mock('expo-application', () => ({
  __esModule: true,
  get nativeApplicationVersion() {
    return mockNativeVersion.current;
  },
}));

import UpgradePrompt from '../UpgradePrompt';

describe('UpgradePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when the current version is up to date', async () => {
    mockNativeVersion.current = '1.0.3';
    mockGetVersionInfo.mockResolvedValueOnce({
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.3',
      storeUrl: 'https://apps.apple.com/app/id0',
    });
    const { queryByTestId } = render(<UpgradePrompt />);
    await waitFor(() => {
      expect(mockGetVersionInfo).toHaveBeenCalled();
    });
    expect(queryByTestId('upgrade-force-modal')).toBeNull();
    expect(queryByTestId('upgrade-recommend-banner')).toBeNull();
  });

  it('renders the blocking force-update modal when current < minVersion', async () => {
    mockNativeVersion.current = '0.9.0';
    mockGetVersionInfo.mockResolvedValueOnce({
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.3',
      storeUrl: 'https://apps.apple.com/app/id0',
    });
    const { findByTestId } = render(<UpgradePrompt />);
    expect(await findByTestId('upgrade-force-modal')).toBeTruthy();
    expect(await findByTestId('upgrade-force-btn')).toBeTruthy();
  });

  it('offers a discreet "offline / try later" escape on the force modal so users are never soft-locked offline', async () => {
    // Reviewer-caught regression: a user who triggered force-mode
    // online then went offline previously had no way out — Linking
    // would silently fail and the modal stayed forever.
    mockNativeVersion.current = '0.9.0';
    mockGetVersionInfo.mockResolvedValueOnce({
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.3',
      storeUrl: 'https://apps.apple.com/app/id0',
    });
    const { findByTestId, queryByTestId } = render(<UpgradePrompt />);
    const defer = await findByTestId('upgrade-force-defer-btn');
    fireEvent.press(defer);
    expect(queryByTestId('upgrade-force-modal')).toBeNull();
  });

  it('renders the dismissible recommend banner when current < latestVersion but >= minVersion', async () => {
    mockNativeVersion.current = '1.0.1';
    mockGetVersionInfo.mockResolvedValueOnce({
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.3',
      storeUrl: 'https://apps.apple.com/app/id0',
    });
    const { findByTestId, queryByTestId } = render(<UpgradePrompt />);
    expect(await findByTestId('upgrade-recommend-banner')).toBeTruthy();
    expect(queryByTestId('upgrade-force-modal')).toBeNull();
  });

  it('opens the store URL when the force-update button is pressed', async () => {
    mockNativeVersion.current = '0.9.0';
    mockGetVersionInfo.mockResolvedValueOnce({
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.3',
      storeUrl: 'https://apps.apple.com/app/id12345',
    });
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    const { findByTestId } = render(<UpgradePrompt />);
    fireEvent.press(await findByTestId('upgrade-force-btn'));
    expect(openSpy).toHaveBeenCalledWith('https://apps.apple.com/app/id12345');
    openSpy.mockRestore();
  });

  it('opens the store URL when the recommend banner button is pressed', async () => {
    mockNativeVersion.current = '1.0.1';
    mockGetVersionInfo.mockResolvedValueOnce({
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.3',
      storeUrl: 'https://apps.apple.com/app/idABC',
    });
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    const { findByTestId } = render(<UpgradePrompt />);
    fireEvent.press(await findByTestId('upgrade-recommend-btn'));
    expect(openSpy).toHaveBeenCalledWith('https://apps.apple.com/app/idABC');
    openSpy.mockRestore();
  });

  it('refuses to open URLs outside the App Store / Play Store allowlist', async () => {
    // CRITICAL security guard: a compromised BE settings layer could
    // ship a phishing URL or `javascript:`/`intent://` payload. The
    // allowlist drops anything that isn't apps.apple.com or
    // play.google.com.
    mockNativeVersion.current = '0.9.0';
    mockGetVersionInfo.mockResolvedValueOnce({
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.3',
      storeUrl: 'https://evil.example.com/phish',
    });
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    const { findByTestId } = render(<UpgradePrompt />);
    fireEvent.press(await findByTestId('upgrade-force-btn'));
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('also rejects dangerous schemes (javascript:, intent://)', async () => {
    mockNativeVersion.current = '0.9.0';
    mockGetVersionInfo.mockResolvedValueOnce({
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.3',
      storeUrl: 'javascript:alert(1)',
    });
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    const { findByTestId } = render(<UpgradePrompt />);
    fireEvent.press(await findByTestId('upgrade-force-btn'));
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('renders nothing when the version-info call fails (fail-open)', async () => {
    // Don't trap users behind a broken endpoint.
    mockGetVersionInfo.mockRejectedValueOnce(new Error('network'));
    const { queryByTestId } = render(<UpgradePrompt />);
    await waitFor(() => {
      expect(mockGetVersionInfo).toHaveBeenCalled();
    });
    expect(queryByTestId('upgrade-force-modal')).toBeNull();
    expect(queryByTestId('upgrade-recommend-banner')).toBeNull();
  });
});
