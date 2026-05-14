import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import CouponShareScreen from '../CouponShareScreen';

const mockShareCoupon = jest.fn();
const mockShareCouponPublic = jest.fn();

jest.mock('../../../services/api/coupons', () => ({
  shareCoupon: (...args: unknown[]) => mockShareCoupon(...args),
  shareCouponPublic: (...args: unknown[]) => mockShareCouponPublic(...args),
}));

const mockRefreshWallet = jest.fn();
jest.mock('../../../state/WalletContext', () => ({
  useWallet: () => ({ refreshWallet: mockRefreshWallet }),
}));

const makeProps = (overrides = {}) => ({
  onNavigate: jest.fn(),
  gems: 3,
  setGems: jest.fn(),
  couPoints: 98,
  setCouPoints: jest.fn(),
  params: {
    id: 'c-9',
    store: '阿明早餐店',
    detail: '$25 現金折抵',
    expires: '11/08',
    amount: 25,
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockShareCouponPublic.mockResolvedValue({ share_link: 'x', token: 't' });
  mockShareCoupon.mockResolvedValue({ share_link: 'x', token: 't' });
  mockRefreshWallet.mockResolvedValue(undefined);
});

describe('CouponShareScreen', () => {
  it('share button is disabled when no target selected', () => {
    const { getByTestId } = render(<CouponShareScreen {...makeProps()} />);
    const btn = getByTestId('confirm-btn');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('selecting a target enables the share button', () => {
    const { getByTestId } = render(<CouponShareScreen {...makeProps()} />);
    fireEvent.press(getByTestId('target-map'));
    const btn = getByTestId('confirm-btn');
    expect(btn.props.accessibilityState?.disabled).toBe(false);
  });

  it('confirm with map target calls shareCouponPublic and refreshes wallet', async () => {
    jest.useFakeTimers();
    const onNavigate = jest.fn();
    const { getByTestId } = render(<CouponShareScreen {...makeProps({ onNavigate })} />);

    fireEvent.press(getByTestId('target-map'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });

    expect(mockShareCouponPublic).toHaveBeenCalledTimes(1);
    expect(mockShareCouponPublic).toHaveBeenCalledWith('c-9', '');
    await waitFor(() => {
      expect(mockRefreshWallet).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onNavigate).toHaveBeenCalledWith('home');
    jest.useRealTimers();
  });

  it('confirm with link target also calls shareCouponPublic (link UI not yet implemented)', async () => {
    const { getByTestId } = render(<CouponShareScreen {...makeProps()} />);

    fireEvent.press(getByTestId('target-link'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });

    expect(mockShareCouponPublic).toHaveBeenCalledTimes(1);
    expect(mockShareCoupon).not.toHaveBeenCalled();
  });

  it('shows error banner if shareCouponPublic fails', async () => {
    mockShareCouponPublic.mockRejectedValueOnce(new Error('share boom'));
    const { getByTestId } = render(<CouponShareScreen {...makeProps()} />);

    fireEvent.press(getByTestId('target-map'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });

    await waitFor(() => {
      expect(getByTestId('share-error')).toBeTruthy();
    });
    expect(mockRefreshWallet).not.toHaveBeenCalled();
  });

  it('shows error banner when params.id is missing', async () => {
    const props = makeProps({ params: { store: 'X' } });
    const { getByTestId } = render(<CouponShareScreen {...props} />);

    fireEvent.press(getByTestId('target-map'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });

    expect(getByTestId('share-error')).toBeTruthy();
    expect(mockShareCouponPublic).not.toHaveBeenCalled();
  });
});
