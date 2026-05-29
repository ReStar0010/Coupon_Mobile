/**
 * useCoopRoom — connection recovery contract tests.
 *
 * The hook owns the only place that can react to a 4401 WS close. The two
 * behaviours under test:
 *
 *   1. On a 4401 close (expired/invalid JWT), attempt a one-shot token
 *      refresh via the auth tokenStore and reconnect with the new token.
 *      If the refresh fails, synthesize an AUTH_FAILED error frame so the
 *      existing reducer surfaces an actionable banner to the user.
 *
 *   2. Expose a `reconnect()` helper so the "Retry" button on CoopRoomScreen
 *      can manually re-establish the connection without remounting.
 *
 * The CoopClient is mocked so we can drive synthetic close events without
 * actually opening a socket.
 */
import React from 'react';
import { Text, View, Button } from 'react-native';
import { render, act, fireEvent, waitFor } from '@testing-library/react-native';

// ── Mock CoopClient ──────────────────────────────────────────────────────────
const mockConnect = jest.fn();
const mockClose = jest.fn();
let lastCtorOpts: any = null;

jest.mock('../coopClient', () => ({
  CoopClient: jest.fn().mockImplementation((opts: any) => {
    lastCtorOpts = opts;
    return {
      connect: mockConnect,
      close: mockClose,
      send: jest.fn(() => true),
    };
  }),
}));

// ── Mock token store ─────────────────────────────────────────────────────────
const mockGetAccessToken = jest.fn();
const mockRefreshTokens = jest.fn();
jest.mock('../../../../services/auth/tokenStore', () => ({
  getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  refreshTokens: (...args: unknown[]) => mockRefreshTokens(...args),
}));

import { useCoopRoom } from '../useCoopRoom';

// ── Test harness component ───────────────────────────────────────────────────
interface HarnessProps {
  onState?: (s: ReturnType<typeof useCoopRoom>) => void;
}
function Harness({ onState }: HarnessProps): React.JSX.Element {
  const coop = useCoopRoom({ token: 'initial-jwt' });
  React.useEffect(() => onState?.(coop));
  return (
    <View>
      <Text testID="status">{coop.status}</Text>
      <Text testID="lastError">{coop.state.lastError?.code ?? ''}</Text>
      <Button title="retry" testID="retry" onPress={() => coop.reconnect?.()} />
    </View>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  lastCtorOpts = null;
  mockGetAccessToken.mockResolvedValue('initial-jwt');
});

describe('useCoopRoom — connection recovery', () => {
  it('connects on mount', async () => {
    render(<Harness />);
    await waitFor(() => expect(mockConnect).toHaveBeenCalled());
  });

  it('on 4401 close, attempts a one-shot token refresh and reconnects with the new JWT', async () => {
    mockRefreshTokens.mockResolvedValueOnce('fresh-jwt');
    const { getByTestId } = render(<Harness />);
    await waitFor(() => expect(mockConnect).toHaveBeenCalled());

    // Fire a 4401 close as if the server rejected the handshake.
    await act(async () => {
      lastCtorOpts.onClose?.('auth_failed', 4401);
    });

    await waitFor(() => expect(mockRefreshTokens).toHaveBeenCalledTimes(1));
    // After refresh, the hook should reconnect — which means the CoopClient
    // sees a fresh token via the thunk on next connect.
    expect(mockConnect.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(getByTestId('status').props.children).not.toBe('closed-permanent');
  });

  it('if the token refresh itself fails, surfaces an AUTH_FAILED error frame', async () => {
    mockRefreshTokens.mockRejectedValueOnce(new Error('refresh dead'));
    const { getByTestId } = render(<Harness />);
    await waitFor(() => expect(mockConnect).toHaveBeenCalled());

    await act(async () => {
      lastCtorOpts.onClose?.('auth_failed', 4401);
    });

    await waitFor(() =>
      expect(getByTestId('lastError').props.children).toBe('SESSION_EXPIRED'),
    );
    // We do NOT keep retrying once refresh has failed — that would loop.
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
  });

  it('exposes a reconnect() helper that re-runs connect()', async () => {
    const { getByTestId } = render(<Harness />);
    await waitFor(() => expect(mockConnect).toHaveBeenCalled());
    const initialCount = mockConnect.mock.calls.length;

    await act(async () => {
      lastCtorOpts.onClose?.('transport', 1006);
    });

    // Click the harness "retry" button — should drive reconnect().
    await act(async () => {
      fireEvent.press(getByTestId('retry'));
    });

    await waitFor(() => expect(mockConnect.mock.calls.length).toBeGreaterThan(initialCount));
  });

  it('does NOT trigger token refresh on non-auth close codes', async () => {
    render(<Harness />);
    await waitFor(() => expect(mockConnect).toHaveBeenCalled());

    await act(async () => {
      lastCtorOpts.onClose?.('transport', 1006);
    });

    expect(mockRefreshTokens).not.toHaveBeenCalled();
  });
});
