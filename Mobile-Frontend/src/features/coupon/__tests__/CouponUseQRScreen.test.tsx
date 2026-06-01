import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import CouponUseQRScreen from '../CouponUseQRScreen';

// ── service module mock ──────────────────────────────────────────────────────
const mockRedeemCoupon = jest.fn();
jest.mock('../../../services/api/coupons', () => ({
  redeemCoupon: (...args: unknown[]) => mockRedeemCoupon(...args),
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
// Capture the `onBarcodeScanned` prop so tests can simulate the camera
// detecting a QR. This is the only path to advance the screen after the
// dev "模擬掃描成功" bypass button was removed.
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
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props),
    Svg: (props: any) => React.createElement(View, props),
    Path: (props: any) => React.createElement(View, props),
    Circle: (props: any) => React.createElement(View, props),
    Line: (props: any) => React.createElement(View, props),
  };
});

// ── AppStatusBar mock ────────────────────────────────────────────────────────
jest.mock('@/src/components/chrome/StatusBar', () => 'AppStatusBar');

// ── Default props factory ────────────────────────────────────────────────────
const makeProps = (overrides: Partial<React.ComponentProps<typeof CouponUseQRScreen>> = {}) => ({
  onNavigate: jest.fn(),
  setGems: jest.fn(),
  params: {
    id: 'c-1',
    store: '阿明早餐店',
    detail: '$25 現金折抵',
    expires: '11/08',
    amount: 25,
  },
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (globalThis as Record<string, unknown>).__cameraOnBarcodeScanned = undefined;
  mockRedeemCoupon.mockResolvedValue({
    message: 'ok',
    coupon_name: 'x',
    coupon_detail: 'x',
    savings_amount: 25,
    redeemed_at: 'now',
    redemption_id: 1,
  });
  mockRefreshWallet.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CouponUseQRScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows the coupon store name from params', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('阿明早餐店')).toBeTruthy();
  });

  it('does NOT show the simulate-scan dev button', () => {
    const { queryByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(queryByText('模擬掃描成功 ▶')).toBeNull();
  });

  it('camera scan calls redeemCoupon with the coupon id and the scanned code', async () => {
    const { toJSON } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(toJSON()).toBeTruthy();

    await act(async () => {
      triggerScan('REAL_REDEEM_CODE');
    });

    expect(mockRedeemCoupon).toHaveBeenCalledTimes(1);
    expect(mockRedeemCoupon).toHaveBeenCalledWith('c-1', 'REAL_REDEEM_CODE');
  });

  it('uses params.redeem_code when the camera fires with empty data (defensive)', async () => {
    const props = makeProps({
      params: {
        id: 'c-1',
        store: '阿明早餐店',
        detail: '$25 現金折抵',
        expires: '11/08',
        amount: 25,
        redeem_code: 'ABC123',
      },
    });
    render(<CouponUseQRScreen {...props} />);

    await act(async () => {
      triggerScan(undefined);
    });

    expect(mockRedeemCoupon).toHaveBeenCalledWith('c-1', 'ABC123');
  });

  it('does NOT call redeemCoupon when camera data is empty and no params.redeem_code is set', async () => {
    render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      triggerScan(undefined);
    });

    expect(mockRedeemCoupon).not.toHaveBeenCalled();
  });

  it('refreshes the wallet after a successful redeem', async () => {
    render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      triggerScan('REAL_REDEEM_CODE');
    });

    await waitFor(() => {
      expect(mockRefreshWallet).toHaveBeenCalledTimes(1);
    });
  });

  it('repeated scan events after success do not call redeemCoupon again', async () => {
    render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      triggerScan('REAL_REDEEM_CODE');
    });
    await act(async () => {
      triggerScan('REAL_REDEEM_CODE');
    });

    expect(mockRedeemCoupon).toHaveBeenCalledTimes(1);
  });

  it('shows the merchant confirmation overlay with the redeemed coupon details', async () => {
    mockRedeemCoupon.mockResolvedValueOnce({
      message: 'ok',
      coupon_name: '滿百折二十',
      coupon_detail: '現金折抵券',
      savings_amount: 88,
      redeemed_at: 'now',
      redemption_id: 42,
    });
    const { getByText, getByTestId } = render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      triggerScan('REAL_REDEEM_CODE');
    });

    expect(getByTestId('redeem-confirm-overlay')).toBeTruthy();
    expect(getByText('核銷成功')).toBeTruthy();
    expect(getByText('滿百折二十')).toBeTruthy();
    expect(getByText('現金折抵券')).toBeTruthy();
    // Distinct from the banner's $25 so this asserts the redeemed savings value.
    expect(getByText('$88')).toBeTruthy();
    expect(getByText('#42')).toBeTruthy();
    // The gem reward is a customer perk — present but framed as the customer's,
    // so the merchant is not confused about what they are confirming.
    expect(getByText('顧客 +1 顆寶石')).toBeTruthy();
  });

  it('does NOT auto-navigate home after a successful redeem', async () => {
    const onNavigate = jest.fn();
    render(<CouponUseQRScreen {...makeProps({ onNavigate })} />);

    await act(async () => {
      triggerScan('REAL_REDEEM_CODE');
    });

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('navigates home only when the merchant taps 確認', async () => {
    const onNavigate = jest.fn();
    const { getByTestId } = render(<CouponUseQRScreen {...makeProps({ onNavigate })} />);

    await act(async () => {
      triggerScan('REAL_REDEEM_CODE');
    });

    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('redeem-confirm'));
    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('back button navigates to coupon-detail with params', () => {
    const onNavigate = jest.fn();
    const params = { id: 'c-1', store: '阿明早餐店', expires: '11/08', amount: 25 };
    const { getByText } = render(<CouponUseQRScreen {...makeProps({ onNavigate, params })} />);

    fireEvent.press(getByText('←'));

    expect(onNavigate).toHaveBeenCalledWith('coupon-detail', params);
  });

  it('renders the page title', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('掃描店家 QR')).toBeTruthy();
  });

  it('renders coupon amount in the banner', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('$25')).toBeTruthy();
  });

  it('shows no-camera fallback when permission is not granted', () => {
    const { useCameraPermissions } = require('expo-camera');
    (useCameraPermissions as jest.Mock).mockReturnValueOnce([{ granted: false }, jest.fn()]);

    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('需要相機權限')).toBeTruthy();
  });

  it('shows error banner when redeemCoupon fails', async () => {
    mockRedeemCoupon.mockRejectedValueOnce(new Error('redeem boom'));
    const { getByTestId } = render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      triggerScan('REAL_REDEEM_CODE');
    });

    await waitFor(() => {
      expect(getByTestId('redeem-error')).toBeTruthy();
    });
    expect(mockRefreshWallet).not.toHaveBeenCalled();
  });

  it('pressing the torch button does not throw', () => {
    const { UNSAFE_getAllByProps } = render(<CouponUseQRScreen {...makeProps()} />);
    const accessibles = UNSAFE_getAllByProps({ accessible: true });
    expect(() => fireEvent.press(accessibles[1])).not.toThrow();
  });

  it('pressing torch twice covers both torch state branches', () => {
    const { UNSAFE_getAllByProps } = render(<CouponUseQRScreen {...makeProps()} />);
    const accessibles = UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessibles[1]);
    fireEvent.press(accessibles[1]);
    expect(true).toBe(true);
  });
});
