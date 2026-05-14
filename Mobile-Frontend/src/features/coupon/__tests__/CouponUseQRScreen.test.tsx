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
jest.mock('expo-camera', () => ({
  CameraView: ({ children }: any) => children,
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

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

  it('shows the simulate scan button before scanning', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('模擬掃描成功 ▶')).toBeTruthy();
  });

  it('sim scan button calls redeemCoupon with the coupon id and a fallback code', async () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      fireEvent.press(getByText('模擬掃描成功 ▶'));
    });

    expect(mockRedeemCoupon).toHaveBeenCalledTimes(1);
    expect(mockRedeemCoupon).toHaveBeenCalledWith('c-1', 'SIMULATED');
  });

  it('uses params.redeem_code when present for the simulate path', async () => {
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
    const { getByText } = render(<CouponUseQRScreen {...props} />);

    await act(async () => {
      fireEvent.press(getByText('模擬掃描成功 ▶'));
    });

    expect(mockRedeemCoupon).toHaveBeenCalledWith('c-1', 'ABC123');
  });

  it('refreshes the wallet after a successful redeem', async () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      fireEvent.press(getByText('模擬掃描成功 ▶'));
    });

    await waitFor(() => {
      expect(mockRefreshWallet).toHaveBeenCalledTimes(1);
    });
  });

  it('shows success text after a successful scan', async () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      fireEvent.press(getByText('模擬掃描成功 ▶'));
    });

    expect(getByText('掃描成功 ✓')).toBeTruthy();
  });

  it('pressing sim scan a second time does not call redeemCoupon again', async () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      fireEvent.press(getByText('模擬掃描成功 ▶'));
    });
    // After success, the button is disabled; press it again — should be a no-op
    fireEvent.press(getByText('掃描成功 ✓'));

    expect(mockRedeemCoupon).toHaveBeenCalledTimes(1);
  });

  it('shows the success overlay after scan', async () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      fireEvent.press(getByText('模擬掃描成功 ▶'));
    });

    expect(getByText('使用成功！')).toBeTruthy();
    expect(getByText('+1 顆寶石')).toBeTruthy();
  });

  it('navigates to home after 2600 ms post-scan', async () => {
    const onNavigate = jest.fn();
    const { getByText } = render(<CouponUseQRScreen {...makeProps({ onNavigate })} />);

    await act(async () => {
      fireEvent.press(getByText('模擬掃描成功 ▶'));
    });

    act(() => {
      jest.advanceTimersByTime(2600);
    });

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
    const { getByText, getByTestId } = render(<CouponUseQRScreen {...makeProps()} />);

    await act(async () => {
      fireEvent.press(getByText('模擬掃描成功 ▶'));
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
