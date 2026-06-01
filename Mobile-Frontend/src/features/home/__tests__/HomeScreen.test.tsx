import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';
import type { Coupon, MyShare } from '../../../services/api/coupons';
import { listMyShares, withdrawShare, getDailyDrawStatus } from '../../../services/api/coupons';

// ── WalletContext mock ───────────────────────────────────────────────────────
const mockRefreshWallet = jest.fn().mockResolvedValue(undefined);
let mockCoupons: Coupon[] = [];
jest.mock('../../../state/WalletContext', () => ({
  useWallet: () => ({
    coupons: mockCoupons,
    refreshWallet: mockRefreshWallet,
  }),
}));

// ── expo-router useFocusEffect mock ──────────────────────────────────────────
// HomeScreen refreshes on focus. The real hook fires the callback on initial
// focus (mount) and again each time the tab re-focuses. We mimic that: run the
// callback once via an effect on mount, and stash it so a test can fire a
// subsequent "re-focus" manually.
const mockFocusEffectHolder: { cb: (() => void | (() => void)) | undefined } = {
  cb: undefined,
};
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactModule = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      mockFocusEffectHolder.cb = cb;
      ReactModule.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [cb]);
    },
  };
});

// ── coupons API mock ─────────────────────────────────────────────────────────
// HomeScreen fetches the user's pending shares + daily-draw status on mount;
// stub both so no real request leaks past test teardown.
jest.mock('../../../services/api/coupons', () => ({
  listMyShares: jest.fn().mockResolvedValue([]),
  withdrawShare: jest.fn().mockResolvedValue(undefined),
  getDailyDrawStatus: jest.fn().mockResolvedValue({ canDrawToday: true, lastDrawDate: null }),
}));

const mockListMyShares = listMyShares as jest.Mock;
const mockWithdrawShare = withdrawShare as jest.Mock;
const mockGetDailyDrawStatus = getDailyDrawStatus as jest.Mock;

const makePublicShare = (overrides: Partial<MyShare> = {}): MyShare => ({
  share_id: 100,
  coupon_id: 1,
  coupon_name: '$25 現金折抵',
  store_name: '阿明早餐店',
  image_url: null,
  is_public: true,
  status: 'pending',
  created_at: '2026-05-31T00:00:00Z',
  ...overrides,
});

/** Auto-confirm the next Alert by invoking its destructive ("收回") button. */
function autoConfirmAlert() {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    const confirm = (buttons ?? []).find((b) => b.style === 'destructive');
    confirm?.onPress?.();
  });
}

const SAMPLE_COUPONS: Coupon[] = [
  {
    id: '1',
    store: '阿明早餐店',
    detail: '$25 現金折抵',
    expires: '11/08',
    amount: 25,
    status: 'active',
    gem_reward: 0,
  },
  {
    id: '2',
    store: '手沖小巷',
    detail: '$10 現金折抵',
    expires: '11/30',
    amount: 10,
    status: 'active',
    gem_reward: 0,
  },
];

const makeProps = (overrides = {}) => ({
  onNavigate: jest.fn(),
  gems: 3,
  setGems: jest.fn(),
  couPoints: 98,
  setCouPoints: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCoupons = SAMPLE_COUPONS;
  mockFocusEffectHolder.cb = undefined;
});

describe('HomeScreen', () => {
  it('renders header with logo and title', () => {
    const { getAllByText } = render(<HomeScreen {...makeProps()} />);
    expect(getAllByText('CouPro').length).toBeGreaterThanOrEqual(1);
  });

  it('renders CouPoints balance', () => {
    const { getByTestId } = render(<HomeScreen {...makeProps({ couPoints: 98 })} />);
    expect(getByTestId('coupoints-balance')).toBeTruthy();
  });

  it('renders coupon list items from wallet coupons', () => {
    const { getAllByTestId } = render(<HomeScreen {...makeProps()} />);
    const rows = getAllByTestId('coupon-row');
    expect(rows.length).toBe(SAMPLE_COUPONS.length);
  });

  it('renders empty state when no coupons', () => {
    mockCoupons = [];
    const { getByTestId, queryAllByTestId } = render(<HomeScreen {...makeProps()} />);
    expect(getByTestId('coupons-empty')).toBeTruthy();
    expect(queryAllByTestId('coupon-row').length).toBe(0);
  });

  it('filters out redeemed coupons from the visible list', () => {
    mockCoupons = [
      ...SAMPLE_COUPONS,
      {
        id: '99',
        store: 'used',
        detail: 'used',
        expires: '12/01',
        amount: 5,
        status: 'redeemed',
        gem_reward: 0,
      },
    ];
    const { getAllByTestId } = render(<HomeScreen {...makeProps()} />);
    expect(getAllByTestId('coupon-row').length).toBe(SAMPLE_COUPONS.length);
  });

  it('tapping a coupon row calls onNavigate with coupon-detail', () => {
    const onNavigate = jest.fn();
    const { getAllByTestId } = render(<HomeScreen {...makeProps({ onNavigate })} />);
    fireEvent.press(getAllByTestId('coupon-row')[0]);
    expect(onNavigate).toHaveBeenCalledWith(
      'coupon-detail',
      expect.objectContaining({ id: '1', store: '阿明早餐店' }),
    );
  });

  it('tapping settings calls onNavigate with settings', () => {
    const onNavigate = jest.fn();
    const { getByTestId } = render(<HomeScreen {...makeProps({ onNavigate })} />);
    fireEvent.press(getByTestId('settings-btn'));
    expect(onNavigate).toHaveBeenCalledWith('settings');
  });

  describe('link-shared coupons stay visible', () => {
    const SHARED_COUPON: Coupon = {
      id: '1',
      store: '阿明早餐店',
      detail: '$25 現金折抵',
      expires: '11/08',
      amount: 25,
      status: 'shared',
      gem_reward: 0,
    };

    it('keeps a link-shared coupon (status "shared") in the wallet list', () => {
      mockCoupons = [SHARED_COUPON];
      const { getAllByTestId } = render(<HomeScreen {...makeProps()} />);
      // The coupon must NOT vanish just because it has an outstanding link share.
      expect(getAllByTestId('coupon-row').length).toBe(1);
    });

    it('badges a link-shared coupon with 分享中 + a withdraw control', async () => {
      mockCoupons = [SHARED_COUPON];
      mockListMyShares.mockResolvedValueOnce([
        makePublicShare({ share_id: 200, coupon_id: 1, is_public: false }),
      ]);
      const { findAllByTestId, getByText } = render(<HomeScreen {...makeProps()} />);
      expect((await findAllByTestId('coupon-withdraw-btn')).length).toBe(1);
      expect(getByText('分享中')).toBeTruthy();
    });
  });

  describe('withdraw shared coupons', () => {
    it('renders the CouMap section with a withdraw button for a pending public share', async () => {
      mockListMyShares.mockResolvedValueOnce([makePublicShare({ share_id: 100 })]);
      const { findByTestId, getByText } = render(<HomeScreen {...makeProps()} />);

      expect(await findByTestId('withdraw-btn-100')).toBeTruthy();
      expect(getByText('已釋出到 CouMap')).toBeTruthy();
    });

    it('withdraws a public share after confirmation', async () => {
      autoConfirmAlert();
      mockListMyShares.mockResolvedValueOnce([makePublicShare({ share_id: 100 })]);
      const { findByTestId } = render(<HomeScreen {...makeProps()} />);

      fireEvent.press(await findByTestId('withdraw-btn-100'));

      await waitFor(() => expect(mockWithdrawShare).toHaveBeenCalledWith(100));
    });

    it('shows a "分享中" badge + withdraw on an active coupon with a pending LINK share', async () => {
      // coupon "1" is active in the wallet; a private (link) share points at it.
      mockListMyShares.mockResolvedValueOnce([
        makePublicShare({ share_id: 200, coupon_id: 1, is_public: false }),
      ]);
      const { findAllByTestId, getByText } = render(<HomeScreen {...makeProps()} />);

      expect((await findAllByTestId('coupon-withdraw-btn')).length).toBe(1);
      expect(getByText('分享中')).toBeTruthy();
    });

    it('withdraws a link share from the coupon card after confirmation', async () => {
      autoConfirmAlert();
      mockListMyShares.mockResolvedValueOnce([
        makePublicShare({ share_id: 200, coupon_id: 1, is_public: false }),
      ]);
      const { findAllByTestId } = render(<HomeScreen {...makeProps()} />);

      fireEvent.press((await findAllByTestId('coupon-withdraw-btn'))[0]);

      await waitFor(() => expect(mockWithdrawShare).toHaveBeenCalledWith(200));
    });
  });

  describe('auto-refresh on focus', () => {
    it('does not re-pull the wallet on the initial focus (mount)', async () => {
      render(<HomeScreen {...makeProps()} />);
      // Shares + draw status load once on mount; the wallet is owned by
      // WalletContext (loaded on auth) and must not be re-fetched on first focus.
      await waitFor(() => expect(mockListMyShares).toHaveBeenCalledTimes(1));
      expect(mockRefreshWallet).not.toHaveBeenCalled();
    });

    it('refreshes wallet + shares + draw status when the screen re-focuses', async () => {
      render(<HomeScreen {...makeProps()} />);
      await waitFor(() => expect(mockListMyShares).toHaveBeenCalledTimes(1));

      // Simulate returning to the home tab after a coupon-changing flow.
      await act(async () => {
        mockFocusEffectHolder.cb?.();
      });

      await waitFor(() => expect(mockRefreshWallet).toHaveBeenCalledTimes(1));
      expect(mockListMyShares).toHaveBeenCalledTimes(2);
      expect(mockGetDailyDrawStatus).toHaveBeenCalledTimes(2);
    });
  });
});
