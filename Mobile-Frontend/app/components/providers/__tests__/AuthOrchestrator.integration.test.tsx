/**
 * Integration tests for AuthOrchestrator - event → navigation
 */

import React from 'react';
import { View } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { authEvents, AUTH_EVENT_TYPES } from '@/app/utils/authEvents';
import AuthProvider from '../SessionProvider';
import AuthOrchestrator from '../AuthOrchestrator';

const mockReplace = jest.fn();
const mockPathname = jest.fn();
const mockSegments = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useSegments: () => mockSegments(),
  usePathname: () => mockPathname(),
}));

describe('AuthOrchestrator (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/(tabs)/easyuse');
    mockSegments.mockReturnValue([]);
  });

  it('on AUTH_FAILURE when not on public route, replaces to login with returnUrl', async () => {
    render(
      <AuthProvider>
        <AuthOrchestrator>
          <View testID="child" />
        </AuthOrchestrator>
      </AuthProvider>,
    );

    authEvents.emit({
      type: AUTH_EVENT_TYPES.AUTH_FAILURE,
      reason: 'refresh_failed',
      returnUrl: '/(tabs)/collection',
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/(auth)/login?returnUrl=' + encodeURIComponent('/(tabs)/collection'),
      );
    });
  });

  it('on LOGOUT_REQUESTED, replaces to login', async () => {
    render(
      <AuthProvider>
        <AuthOrchestrator>
          <View testID="child" />
        </AuthOrchestrator>
      </AuthProvider>,
    );

    authEvents.emit({ type: AUTH_EVENT_TYPES.LOGOUT_REQUESTED });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('on AUTH_FAILURE when already on login route, does not replace', async () => {
    mockPathname.mockReturnValue('/(auth)/login');
    mockSegments.mockReturnValue(['(auth)']);

    render(
      <AuthProvider>
        <AuthOrchestrator>
          <View testID="child" />
        </AuthOrchestrator>
      </AuthProvider>,
    );

    authEvents.emit({ type: AUTH_EVENT_TYPES.AUTH_FAILURE, reason: 'test' });

    await waitFor(() => {}, { timeout: 200 });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
