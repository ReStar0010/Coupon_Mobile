import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import CouponReceiveQRScreen from '../CouponReceiveQRScreen';

const mockReceiveCoupon = jest.fn();
jest.mock('../../../services/api/coupons', () => ({
  receiveCoupon: (...args: unknown[]) => mockReceiveCoupon(...args),
}));

const mockRefreshWallet = jest.fn();
jest.mock('../../../state/WalletContext', () => ({
  useWallet: () => ({ refreshWallet: mockRefreshWallet }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Capture onBarcodeScanned so tests can fire real-looking scan events.
// The "模擬掃描成功" dev bypass button has been removed; this is the
// only entry point into the receive flow.
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

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: object) => React.createElement(View, props),
    Svg: (props: object) => React.createElement(View, props),
    Path: (props: object) => React.createElement(View, props),
  };
});

const makeProps = (
  overrides: Partial<React.ComponentProps<typeof CouponReceiveQRScreen>> = {},
) => ({
  onBack: jest.fn(),
  onDone: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (globalThis as Record<string, unknown>).__cameraOnBarcodeScanned = undefined;
  mockReceiveCoupon.mockResolvedValue({
    message: 'ok',
    coupon_id: 1,
    coupon_name: 'x',
    template_id: 1,
    remaining_quantity: 0,
    acquisition_method: 'qr_claim',
  });
  mockRefreshWallet.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CouponReceiveQRScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<CouponReceiveQRScreen {...makeProps()} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows the receive header copy', () => {
    const { getByText } = render(<CouponReceiveQRScreen {...makeProps()} />);
    expect(getByText('掃描店家 QR 領取優惠券')).toBeTruthy();
    expect(getByText('領取店家優惠')).toBeTruthy();
  });

  it('does NOT show the simulate-scan dev button', () => {
    const { queryByTestId } = render(<CouponReceiveQRScreen {...makeProps()} />);
    expect(queryByTestId('receive-qr-simulate')).toBeNull();
  });

  it('back button calls onBack', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<CouponReceiveQRScreen {...makeProps({ onBack })} />);
    fireEvent.press(getByTestId('receive-qr-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('camera scan calls receiveCoupon with the scanned token and idempotency key', async () => {
    render(<CouponReceiveQRScreen {...makeProps()} />);
    await act(async () => {
      triggerScan('REAL_SHARE_TOKEN');
    });

    expect(mockReceiveCoupon).toHaveBeenCalledTimes(1);
    const [token, key] = mockReceiveCoupon.mock.calls[0];
    expect(token).toBe('REAL_SHARE_TOKEN');
    expect(typeof key).toBe('string');
    expect((key as string).length).toBeGreaterThan(0);
  });

  it('does NOT call receiveCoupon when camera data is empty', async () => {
    render(<CouponReceiveQRScreen {...makeProps()} />);
    await act(async () => {
      triggerScan(undefined);
    });
    // The removed `?? 'SIMULATED'` fallback used to send a literal to the
    // backend on empty data. After removal the scan is ignored.
    expect(mockReceiveCoupon).not.toHaveBeenCalled();
  });

  it('refreshes the wallet after a successful receive', async () => {
    render(<CouponReceiveQRScreen {...makeProps()} />);
    await act(async () => {
      triggerScan('REAL_SHARE_TOKEN');
    });

    await waitFor(() => {
      expect(mockRefreshWallet).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the success overlay after a successful scan', async () => {
    const { getByTestId, queryByTestId } = render(<CouponReceiveQRScreen {...makeProps()} />);
    expect(queryByTestId('receive-success')).toBeNull();
    await act(async () => {
      triggerScan('REAL_SHARE_TOKEN');
    });
    expect(getByTestId('receive-success')).toBeTruthy();
  });

  it('calls onDone after the success delay', async () => {
    const onDone = jest.fn();
    render(<CouponReceiveQRScreen {...makeProps({ onDone })} />);
    await act(async () => {
      triggerScan('REAL_SHARE_TOKEN');
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(2400);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('torch button toggles without crashing', () => {
    const { getByTestId } = render(<CouponReceiveQRScreen {...makeProps()} />);
    fireEvent.press(getByTestId('receive-qr-torch'));
    fireEvent.press(getByTestId('receive-qr-torch'));
  });

  it('does not call receiveCoupon twice on repeated scan events', async () => {
    const onDone = jest.fn();
    render(<CouponReceiveQRScreen {...makeProps({ onDone })} />);
    await act(async () => {
      triggerScan('REAL_SHARE_TOKEN');
    });
    await act(async () => {
      triggerScan('REAL_SHARE_TOKEN');
    });
    act(() => {
      jest.advanceTimersByTime(2400);
    });
    expect(mockReceiveCoupon).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onDone after unmount', async () => {
    const onDone = jest.fn();
    const { unmount } = render(<CouponReceiveQRScreen {...makeProps({ onDone })} />);
    await act(async () => {
      triggerScan('REAL_SHARE_TOKEN');
    });
    unmount();
    act(() => {
      jest.advanceTimersByTime(2400);
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('shows error banner when receiveCoupon fails', async () => {
    mockReceiveCoupon.mockRejectedValueOnce(new Error('receive boom'));
    const { getByTestId } = render(<CouponReceiveQRScreen {...makeProps()} />);
    await act(async () => {
      triggerScan('REAL_SHARE_TOKEN');
    });

    await waitFor(() => {
      expect(getByTestId('receive-error')).toBeTruthy();
    });
    expect(mockRefreshWallet).not.toHaveBeenCalled();
  });
});
