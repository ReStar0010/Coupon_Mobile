import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import CouPointUseScreen from '../CouPointUseScreen';

// ── coupoint service mock ────────────────────────────────────────────────────
const mockSubmitCouPointSpend = jest.fn();
jest.mock('../../../services/api/coupoint', () => ({
  submitCouPointSpend: (...args: unknown[]) => mockSubmitCouPointSpend(...args),
}));

// ── WalletContext mock ───────────────────────────────────────────────────────
const mockRefreshWallet = jest.fn();
jest.mock('../../../state/WalletContext', () => ({
  useWallet: () => ({ refreshWallet: mockRefreshWallet }),
}));

// ── safe-area mock ───────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// ── expo-camera mock ─────────────────────────────────────────────────────────
// CameraView is replaced with a stub component that captures the
// `onBarcodeScanned` prop onto a global. Tests trigger a "scan" by
// calling triggerScan(token) which invokes the captured callback —
// this is the only way to advance the screen now that the dev-only
// "模擬掃描成功" bypass button has been removed.
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: (props: { onBarcodeScanned?: (e: { data?: string }) => void }) => {
      (globalThis as Record<string, unknown>).__cameraOnBarcodeScanned = props.onBarcodeScanned;
      return React.createElement(View, props);
    },
    useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
  };
});

const triggerScan = (data: string | undefined) => {
  const cb = (globalThis as Record<string, unknown>).__cameraOnBarcodeScanned as
    | ((e: { data?: string }) => void)
    | undefined;
  cb?.({ data });
};

// ── react-native-svg mock ────────────────────────────────────────────────────
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props),
    Svg: (props: any) => React.createElement(View, props),
    Path: (props: any) => React.createElement(View, props),
    Circle: (props: any) => React.createElement(View, props),
    Line: (props: any) => React.createElement(View, props),
    Text: (props: any) => React.createElement(Text, props),
    G: (props: any) => React.createElement(View, props),
    Defs: (props: any) => React.createElement(View, props),
    Rect: (props: any) => React.createElement(View, props),
  };
});

const makeProps = (overrides: Partial<React.ComponentProps<typeof CouPointUseScreen>> = {}) => ({
  onNavigate: jest.fn(),
  couPoints: 100,
  setCouPoints: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (globalThis as Record<string, unknown>).__cameraOnBarcodeScanned = undefined;
  mockSubmitCouPointSpend.mockResolvedValue({
    couPoints: 95,
    store: { id: 1, name: '測試店家', address: 'addr' },
    transactionId: 42,
    amount: 5,
  });
  mockRefreshWallet.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CouPointUseScreen', () => {
  it('renders the scan phase initially without a simulate-scan dev button', () => {
    const { queryByTestId, queryByText } = render(<CouPointUseScreen {...makeProps()} />);
    expect(queryByTestId('sim-scan-btn')).toBeNull();
    expect(queryByText('模擬掃描成功 ▶')).toBeNull();
  });

  it('transitions to amount phase after the camera emits a real QR scan', () => {
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    act(() => {
      triggerScan('REAL_TOKEN_XYZ');
    });
    expect(getByTestId('confirm-btn')).toBeTruthy();
  });

  it('calls submitCouPointSpend with the scanned token (NOT the literal SIMULATED)', async () => {
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    act(() => {
      triggerScan('REAL_TOKEN_XYZ');
    });
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });
    expect(mockSubmitCouPointSpend).toHaveBeenCalledWith('REAL_TOKEN_XYZ', 5);
  });

  it('ignores camera events with empty data (no phase transition, no API call)', () => {
    // Defensive guard against the removed `?? 'SIMULATED'` fallback: an
    // empty scan event must not advance the UI or fire a request.
    const { queryByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    act(() => {
      triggerScan(undefined);
    });
    expect(queryByTestId('confirm-btn')).toBeNull();
    expect(mockSubmitCouPointSpend).not.toHaveBeenCalled();
  });

  it('refreshes wallet on successful confirm', async () => {
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    act(() => {
      triggerScan('REAL_TOKEN_XYZ');
    });
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });
    await waitFor(() => expect(mockRefreshWallet).toHaveBeenCalled());
  });

  it('shows store name on success', async () => {
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    act(() => {
      triggerScan('REAL_TOKEN_XYZ');
    });
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });
    await waitFor(() => expect(getByTestId('success-store')).toBeTruthy());
  });

  it('surfaces an error message and does NOT refresh wallet on failure', async () => {
    mockSubmitCouPointSpend.mockRejectedValueOnce(new Error('餘額不足'));
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    act(() => {
      triggerScan('REAL_TOKEN_XYZ');
    });
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });
    await waitFor(() => expect(getByTestId('coupoint-error')).toBeTruthy());
    expect(mockRefreshWallet).not.toHaveBeenCalled();
  });

  it('shows insufficient balance UI when couPoints < 5', () => {
    const { getByText, queryByTestId } = render(
      <CouPointUseScreen {...makeProps({ couPoints: 3 })} />,
    );
    act(() => {
      triggerScan('REAL_TOKEN_XYZ');
    });
    expect(getByText('餘額不足')).toBeTruthy();
    expect(queryByTestId('confirm-btn')).toBeNull();
  });
});
