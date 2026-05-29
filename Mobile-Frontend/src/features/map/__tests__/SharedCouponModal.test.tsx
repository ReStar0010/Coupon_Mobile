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

// ── Helpers ───────────────────────────────────────────────────────────────────

const sampleCoupon: SharedCoupon = {
  token: 'tok-sample',
  store: '阿明早餐店',
  amount: 50,
  sharer: '小明',
  msg: '這家真的很好吃！',
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

  it('renders the coupon amount', () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    expect(getByText('50')).toBeTruthy();
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

  it('pressing claim button shows success state immediately', () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    fireEvent.press(getByText('確認領取 →'));
    expect(getByText('領取成功！')).toBeTruthy();
  });

  it('success state shows coupon amount', () => {
    const { getByText } = render(<SharedCouponModal {...makeProps()} />);
    fireEvent.press(getByText('確認領取 →'));
    expect(getByText('$50')).toBeTruthy();
  });

  it('calls onClaim after 1200 ms when claim is pressed', () => {
    const onClaim = jest.fn();
    const { getByText } = render(<SharedCouponModal {...makeProps({ onClaim })} />);
    fireEvent.press(getByText('確認領取 →'));

    expect(onClaim).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(1200); });

    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('does not call onClaim before 1200 ms have elapsed', () => {
    const onClaim = jest.fn();
    const { getByText } = render(<SharedCouponModal {...makeProps({ onClaim })} />);
    fireEvent.press(getByText('確認領取 →'));

    act(() => { jest.advanceTimersByTime(1199); });

    expect(onClaim).not.toHaveBeenCalled();
  });

  it('renders nothing when coupon is null', () => {
    const { toJSON } = render(<SharedCouponModal {...makeProps({ coupon: null })} />);
    // Component returns <></> when coupon is null
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when visible is false', () => {
    const { queryByText } = render(
      <SharedCouponModal {...makeProps({ visible: false })} />,
    );
    expect(queryByText('有人分享了一張券給你')).toBeNull();
  });

  it('renders coupon with optional label when provided', () => {
    const couponWithLabel: SharedCoupon = { ...sampleCoupon, label: 'VIP' };
    const { getByText } = render(
      <SharedCouponModal {...makeProps({ coupon: couponWithLabel })} />,
    );
    // Label field is defined but not rendered in UI; ensure other fields still show
    expect(getByText('阿明早餐店')).toBeTruthy();
  });

  it('renders different store name correctly', () => {
    const otherCoupon: SharedCoupon = { ...sampleCoupon, store: '鼎泰豐', amount: 100 };
    const { getByText } = render(
      <SharedCouponModal {...makeProps({ coupon: otherCoupon })} />,
    );
    expect(getByText('鼎泰豐')).toBeTruthy();
    expect(getByText('100')).toBeTruthy();
  });
});
