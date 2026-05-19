import React from 'react';
import { Share } from 'react-native';
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

  it('confirm with link target mints a private share and opens the native share sheet', async () => {
    mockShareCoupon.mockResolvedValueOnce({
      share_link: 'coupro://collection?token=abc',
      share_link_web: 'https://api.coupro.pro/collection/abc/?open_ext=1',
      token: 'abc',
    });
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction } as never);

    const { getByTestId } = render(<CouponShareScreen {...makeProps()} />);
    fireEvent.press(getByTestId('target-link'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });

    // No public-pool call; instead a private share + RN's Share.share.
    expect(mockShareCouponPublic).not.toHaveBeenCalled();
    expect(mockShareCoupon).toHaveBeenCalledWith('c-9');
    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://api.coupro.pro/collection/abc/?open_ext=1' }),
    );
    shareSpy.mockRestore();
  });

  it('does NOT mark success when the user dismisses the share sheet without sharing', async () => {
    // Regression caught by code review: Share.share resolves with
    // dismissedAction when the OS sheet is cancelled. Treating that as
    // "shared" inflated analytics and incorrectly showed the success
    // overlay.
    mockShareCoupon.mockResolvedValueOnce({
      share_link: 'coupro://collection?token=xyz',
      share_link_web: 'https://api.coupro.pro/collection/xyz/?open_ext=1',
      token: 'xyz',
    });
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction } as never);

    const { getByTestId, queryByText } = render(<CouponShareScreen {...makeProps()} />);
    fireEvent.press(getByTestId('target-link'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-btn'));
    });

    expect(shareSpy).toHaveBeenCalled();
    // Success overlay must NOT appear — the user cancelled.
    expect(queryByText('已分享！')).toBeNull();
    shareSpy.mockRestore();
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
