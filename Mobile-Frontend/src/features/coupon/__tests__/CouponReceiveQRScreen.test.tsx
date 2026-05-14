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

jest.mock('expo-camera', () => ({
  CameraView: ({ children }: { children?: React.ReactNode }) => children ?? null,
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

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

  it('back button calls onBack', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<CouponReceiveQRScreen {...makeProps({ onBack })} />);
    fireEvent.press(getByTestId('receive-qr-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('simulate scan calls receiveCoupon with a token and idempotency key', async () => {
    const { getByTestId } = render(<CouponReceiveQRScreen {...makeProps()} />);
    await act(async () => {
      fireEvent.press(getByTestId('receive-qr-simulate'));
    });

    expect(mockReceiveCoupon).toHaveBeenCalledTimes(1);
    const [token, key] = mockReceiveCoupon.mock.calls[0];
    expect(token).toBe('SIMULATED');
    expect(typeof key).toBe('string');
    expect((key as string).length).toBeGreaterThan(0);
  });

  it('refreshes the wallet after a successful receive', async () => {
    const { getByTestId } = render(<CouponReceiveQRScreen {...makeProps()} />);
    await act(async () => {
      fireEvent.press(getByTestId('receive-qr-simulate'));
    });

    await waitFor(() => {
      expect(mockRefreshWallet).toHaveBeenCalledTimes(1);
    });
  });

  it('simulate scan shows the success overlay', async () => {
    const { getByTestId, queryByTestId } = render(<CouponReceiveQRScreen {...makeProps()} />);
    expect(queryByTestId('receive-success')).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId('receive-qr-simulate'));
    });
    expect(getByTestId('receive-success')).toBeTruthy();
  });

  it('calls onDone after the success delay', async () => {
    const onDone = jest.fn();
    const { getByTestId } = render(<CouponReceiveQRScreen {...makeProps({ onDone })} />);
    await act(async () => {
      fireEvent.press(getByTestId('receive-qr-simulate'));
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

  it('does not call receiveCoupon twice on repeated scan press', async () => {
    const onDone = jest.fn();
    const { getByTestId } = render(<CouponReceiveQRScreen {...makeProps({ onDone })} />);
    await act(async () => {
      fireEvent.press(getByTestId('receive-qr-simulate'));
    });
    fireEvent.press(getByTestId('receive-qr-simulate'));
    act(() => {
      jest.advanceTimersByTime(2400);
    });
    expect(mockReceiveCoupon).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onDone after unmount (e.g. user swipes/navigates away mid-success)', async () => {
    const onDone = jest.fn();
    const { getByTestId, unmount } = render(<CouponReceiveQRScreen {...makeProps({ onDone })} />);
    await act(async () => {
      fireEvent.press(getByTestId('receive-qr-simulate'));
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
      fireEvent.press(getByTestId('receive-qr-simulate'));
    });

    await waitFor(() => {
      expect(getByTestId('receive-error')).toBeTruthy();
    });
    expect(mockRefreshWallet).not.toHaveBeenCalled();
  });
});
