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

const NOTE = '希望你會喜歡～～';

/** Select target + fill mandatory note so the confirm button is enabled. */
function fillForm(
  helpers: ReturnType<typeof render>,
  target: 'map' | 'link' = 'map',
  note: string = NOTE,
) {
  fireEvent.press(helpers.getByTestId(`target-${target}`));
  fireEvent.changeText(helpers.getByPlaceholderText(/我吃過很喜歡/), note);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockShareCouponPublic.mockResolvedValue({ share_link: 'x', token: 't' });
  mockShareCoupon.mockResolvedValue({ share_link: 'x', token: 't' });
  mockRefreshWallet.mockResolvedValue(undefined);
});

describe('CouponShareScreen', () => {
  it('share button disabled when no target selected', () => {
    const h = render(<CouponShareScreen {...makeProps()} />);
    expect(h.getByTestId('confirm-btn').props.accessibilityState?.disabled).toBe(true);
  });

  it('share button disabled when target set but note empty', () => {
    const h = render(<CouponShareScreen {...makeProps()} />);
    fireEvent.press(h.getByTestId('target-map'));
    expect(h.getByTestId('confirm-btn').props.accessibilityState?.disabled).toBe(true);
  });

  it('share button enabled when target and note are both set', () => {
    const h = render(<CouponShareScreen {...makeProps()} />);
    fillForm(h);
    expect(h.getByTestId('confirm-btn').props.accessibilityState?.disabled).toBe(false);
  });

  it('confirm with map target calls shareCouponPublic with the note', async () => {
    jest.useFakeTimers();
    const onNavigate = jest.fn();
    const h = render(<CouponShareScreen {...makeProps({ onNavigate })} />);

    fillForm(h, 'map');
    await act(async () => {
      fireEvent.press(h.getByTestId('confirm-btn'));
    });

    expect(mockShareCouponPublic).toHaveBeenCalledWith('c-9', NOTE);
    // refreshWallet is now fire-and-forget — resolve its pending promise.
    await act(async () => {});
    expect(mockRefreshWallet).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(3000));
    expect(onNavigate).toHaveBeenCalledWith('home');
    jest.useRealTimers();
  });

  it('confirm with link target mints a private share and opens native share sheet', async () => {
    mockShareCoupon.mockResolvedValueOnce({
      share_link: 'coupro://collection?token=abc',
      share_link_web: 'https://api.coupro.pro/collection/abc/?open_ext=1',
      token: 'abc',
    });
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction } as never);

    const h = render(<CouponShareScreen {...makeProps()} />);
    fillForm(h, 'link');
    await act(async () => {
      fireEvent.press(h.getByTestId('confirm-btn'));
    });

    expect(mockShareCouponPublic).not.toHaveBeenCalled();
    expect(mockShareCoupon).toHaveBeenCalledWith('c-9');
    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.coupro.pro/collection/abc/?open_ext=1',
        message: expect.stringContaining(NOTE),
      }),
    );
    shareSpy.mockRestore();
  });

  it('does NOT mark success when user dismisses the share sheet', async () => {
    mockShareCoupon.mockResolvedValueOnce({
      share_link: 'coupro://collection?token=xyz',
      share_link_web: 'https://api.coupro.pro/collection/xyz/?open_ext=1',
      token: 'xyz',
    });
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction } as never);

    const h = render(<CouponShareScreen {...makeProps()} />);
    fillForm(h, 'link');
    await act(async () => {
      fireEvent.press(h.getByTestId('confirm-btn'));
    });

    expect(shareSpy).toHaveBeenCalled();
    expect(h.queryByText('已分享！')).toBeNull();
    shareSpy.mockRestore();
  });

  it('shows error banner if shareCouponPublic fails', async () => {
    mockShareCouponPublic.mockRejectedValueOnce(new Error('share boom'));
    const h = render(<CouponShareScreen {...makeProps()} />);

    fillForm(h, 'map');
    await act(async () => {
      fireEvent.press(h.getByTestId('confirm-btn'));
    });

    await waitFor(() => {
      expect(h.getByTestId('share-error')).toBeTruthy();
    });
    expect(mockRefreshWallet).not.toHaveBeenCalled();
  });

  it('shows error banner when params.id is missing', async () => {
    const props = makeProps({ params: { store: 'X' } });
    const h = render(<CouponShareScreen {...props} />);

    fillForm(h, 'map');
    await act(async () => {
      fireEvent.press(h.getByTestId('confirm-btn'));
    });

    expect(h.getByTestId('share-error')).toBeTruthy();
    expect(mockShareCouponPublic).not.toHaveBeenCalled();
  });
});
