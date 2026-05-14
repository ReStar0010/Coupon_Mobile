import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import CouPointUseScreen from '../CouPointUseScreen';

// ── coupoint service mock ────────────────────────────────────────────────────
const mockUseCouPoints = jest.fn();
jest.mock('../../../services/api/coupoint', () => ({
  useCouPoints: (...args: unknown[]) => mockUseCouPoints(...args),
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
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

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
  mockUseCouPoints.mockResolvedValue({
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
  it('renders the scan phase initially', () => {
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    expect(getByTestId('sim-scan-btn')).toBeTruthy();
  });

  it('transitions to amount phase after simulated scan', () => {
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    fireEvent.press(getByTestId('sim-scan-btn'));
    expect(getByTestId('confirm-btn')).toBeTruthy();
  });

  it('calls useCouPoints with token and amount on confirm', async () => {
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    fireEvent.press(getByTestId('sim-scan-btn'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });
    expect(mockUseCouPoints).toHaveBeenCalledWith('SIMULATED', 5);
  });

  it('refreshes wallet on successful confirm', async () => {
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    fireEvent.press(getByTestId('sim-scan-btn'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });
    await waitFor(() => expect(mockRefreshWallet).toHaveBeenCalled());
  });

  it('shows store name on success', async () => {
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    fireEvent.press(getByTestId('sim-scan-btn'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });
    await waitFor(() => expect(getByTestId('success-store')).toBeTruthy());
  });

  it('surfaces an error message and does NOT refresh wallet on failure', async () => {
    mockUseCouPoints.mockRejectedValueOnce(new Error('餘額不足'));
    const { getByTestId } = render(<CouPointUseScreen {...makeProps()} />);
    fireEvent.press(getByTestId('sim-scan-btn'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });
    await waitFor(() => expect(getByTestId('coupoint-error')).toBeTruthy());
    expect(mockRefreshWallet).not.toHaveBeenCalled();
  });

  it('shows insufficient balance UI when couPoints < 5', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <CouPointUseScreen {...makeProps({ couPoints: 3 })} />,
    );
    fireEvent.press(getByTestId('sim-scan-btn'));
    expect(getByText('餘額不足')).toBeTruthy();
    expect(queryByTestId('confirm-btn')).toBeNull();
  });
});
