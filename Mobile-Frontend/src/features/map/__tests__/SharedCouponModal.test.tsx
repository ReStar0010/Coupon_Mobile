import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SharedCouponModal, { SharedCoupon } from '../SharedCouponModal';

// ── react-native-svg mock ────────────────────────────────────────────────────
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props),
    Svg: (props: any) => React.createElement(View, props),
    Path: () => null,
    Circle: () => null,
    Line: () => null,
  };
});

// ── WalletContext mock ────────────────────────────────────────────────────────
// The modal pulls refreshWallet() after a successful claim so the freshly
// claimed coupon shows up on the Home tab. Mock it so we can both render the
// modal outside a provider and assert the refresh fires.
const mockRefreshWallet = jest.fn().mockResolvedValue(undefined);
jest.mock('@/src/state/WalletContext', () => ({
  useWallet: () => ({ refreshWallet: mockRefreshWallet }),
}));

// ── sharing API mock ──────────────────────────────────────────────────────────
const mockAcceptShare = jest.fn();
jest.mock('@/src/services/api/sharing', () => ({
  acceptShare: (...args: unknown[]) => mockAcceptShare(...args),
}));

/** Press the claim button and flush the async acceptShare → setClaimed chain. */
async function pressClaim(getByText: (t: string) => unknown): Promise<void> {
  await act(async () => {
    fireEvent.press(getByText('確認領取 →') as never);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sampleCoupon: SharedCoupon = {
  token: 'tok-sample',
  store: '阿明早餐店',
  amount: 50,
  sharer: '小明',
  msg: '這家真的很好吃！',
  label: '購買任一便當 折5元',
  detail: '限內用 · 不可與其他優惠合併',
  type: 'exclusive',
  expires: '2026/06/30',
  gem_reward: 1,
};

const makeProps = (overrides: Partial<React.ComponentProps<typeof SharedCouponModal>> = {}) => ({
  visible: true,
  coupon: sampleCoupon,
  onClaim: jest.fn(),
  onClose: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockAcceptShare.mockResolvedValue(undefined);
  mockRefreshWallet.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SharedCouponModal', () => {
  it('renders without crashing when visible with coupon', () => {
    const { toJSON } = render(<SharedCouponModal {...makeProps()} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders the store name', () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    expect(getByText('阿明早餐店')).toBeTruthy();
  });

  it('renders coupon info (name, detail, savings, type, expiry) — not a money hero', () => {
    const { getByText, queryByText } = render(<SharedCouponModal {...makeProps()} />);
    expect(getByText('購買任一便當 折5元')).toBeTruthy(); // title (name)
    expect(getByText('限內用 · 不可與其他優惠合併')).toBeTruthy(); // detail line
    expect(getByText('可省 $50')).toBeTruthy(); // small savings badge
    expect(getByText('專屬優惠')).toBeTruthy(); // type label
    expect(getByText('2026/06/30')).toBeTruthy(); // 到期日
    expect(getByText('到期日')).toBeTruthy();
    expect(getByText('分享獎勵')).toBeTruthy();
    // The old giant "$ amount + 現金折抵券" hero must be gone.
    expect(queryByText('現金折抵券')).toBeNull();
  });

  it('shows 隨取即用 for store-type shared coupons', () => {
    const storeCoupon: SharedCoupon = { ...sampleCoupon, type: 'store' };
    const { getByText } = render(<SharedCouponModal {...makeProps({ coupon: storeCoupon })} />);
    expect(getByText('隨取即用')).toBeTruthy();
  });

  it('renders the sharer name', () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    expect(getByText(/小明/)).toBeTruthy();
  });

  it('renders the sharer message', () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    expect(getByText(/這家真的很好吃！/)).toBeTruthy();
  });

  it('renders the heading text', () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    expect(getByText('有人分享了一張券給你')).toBeTruthy();
  });

  it('renders claim and skip buttons', () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    expect(getByText('確認領取 →')).toBeTruthy();
    expect(getByText('略過')).toBeTruthy();
  });

  it('pressing skip (略過) calls onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(<SharedCouponModal {...makeProps({ onClose })} />);
    fireEvent.press(getByText('略過'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pressing skip does not call onClaim', () => {
    const onClaim = jest.fn();
    const { getByText } = render(<SharedCouponModal {...makeProps({ onClaim })} />);
    fireEvent.press(getByText('略過'));
    expect(onClaim).not.toHaveBeenCalled();
  });

  it('shows success state after a successful claim', async () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    await pressClaim(getByText);
    expect(getByText('領取成功！')).toBeTruthy();
  });

  it('success state names the coupon (no money figure)', async () => {
    const { getByText, queryByText } = render(<SharedCouponModal {...makeProps()} />);
    await pressClaim(getByText);
    expect(getByText(/購買任一便當 折5元/)).toBeTruthy();
    expect(queryByText('$50')).toBeNull();
  });

  it('calls acceptShare with the coupon token on claim', async () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    await pressClaim(getByText);
    expect(mockAcceptShare).toHaveBeenCalledWith('tok-sample');
  });

  it('refreshes the wallet after a successful claim so Home shows the new coupon', async () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    await pressClaim(getByText);
    expect(mockRefreshWallet).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the wallet or show success when the claim fails', async () => {
    mockAcceptShare.mockRejectedValueOnce(new Error('領取失敗'));
    const { getByText, queryByText } = render(<SharedCouponModal {...makeProps()} />);
    await pressClaim(getByText);
    expect(mockRefreshWallet).not.toHaveBeenCalled();
    expect(queryByText('領取成功！')).toBeNull();
    expect(getByText('領取失敗')).toBeTruthy();
  });

  it('calls onClaim after 1200 ms when claim is pressed', async () => {
    const onClaim = jest.fn();
    const { getByText } = render(<SharedCouponModal {...makeProps({ onClaim })} />);
    await pressClaim(getByText);

    expect(onClaim).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('does not call onClaim before 1200 ms have elapsed', async () => {
    const onClaim = jest.fn();
    const { getByText } = render(<SharedCouponModal {...makeProps({ onClaim })} />);
    await pressClaim(getByText);

    act(() => {
      jest.advanceTimersByTime(1199);
    });

    expect(onClaim).not.toHaveBeenCalled();
  });

  it('renders nothing when coupon is null', () => {
    const { toJSON } = render(<SharedCouponModal {...makeProps({ coupon: null })} />);
    // Component returns <></> when coupon is null
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when visible is false', () => {
    const { queryByText } = render(<SharedCouponModal {...makeProps({ visible: false })} />);
    expect(queryByText('有人分享了一張券給你')).toBeNull();
  });

  it('renders the coupon name (label) as the title', () => {
    const couponWithLabel: SharedCoupon = { ...sampleCoupon, label: '買一送一' };
    const { getByText } = render(<SharedCouponModal {...makeProps({ coupon: couponWithLabel })} />);
    expect(getByText('買一送一')).toBeTruthy();
  });

  it('renders different store name correctly', () => {
    const otherCoupon: SharedCoupon = { ...sampleCoupon, store: '鼎泰豐', amount: 100 };
    const { getByText } = render(<SharedCouponModal {...makeProps({ coupon: otherCoupon })} />);
    expect(getByText('鼎泰豐')).toBeTruthy();
    expect(getByText('可省 $100')).toBeTruthy();
  });

  it('hides the savings badge when there is no estimated savings', () => {
    const noSavings: SharedCoupon = { ...sampleCoupon, amount: 0 };
    const { queryByText } = render(<SharedCouponModal {...makeProps({ coupon: noSavings })} />);
    expect(queryByText(/可省/)).toBeNull();
  });
});
