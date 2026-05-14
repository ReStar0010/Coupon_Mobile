import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MerchantSheet from '../MerchantSheet';
import type { MerchantDetail } from '@/src/services/api/merchants';

jest.mock('@/src/components/ui/BottomSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? React.createElement(View, { testID: 'bottom-sheet' }, children) : null;
});

const baseMerchant: MerchantDetail = {
  id: '1',
  name: '阿明早餐店',
  category: 'food',
  lat: 25.0478,
  lng: 121.5318,
  address: '忠孝東路 3 段',
  verified: true,
  logoUrl: null,
  distanceKm: 0.3,
  myCoupons: [
    { id: 'mc1', label: '折抵', detail: '$25 現金折抵', expires: '11/08', amount: 25 },
    { id: 'mc2', label: '買一送一', detail: '美式咖啡', expires: '11/15', amount: 0 },
  ],
  sharedCoupons: [
    { store: '阿明早餐店', amount: 5, sharer: 'A', msg: 'a', label: '折抵' },
    { store: '阿明早餐店', amount: 10, sharer: 'B', msg: 'b', label: '兌換' },
    { store: '阿明早餐店', amount: 8, sharer: 'C', msg: 'c', label: '折抵' },
    { store: '阿明早餐店', amount: 15, sharer: 'D', msg: 'd', label: '折抵' },
    { store: '阿明早餐店', amount: 20, sharer: 'E', msg: 'e', label: '折抵' },
  ],
  news: [
    {
      id: 1,
      author: '阿明早餐店',
      agoText: '2 小時前',
      body: '今天有新品 — 起司蛋餅試賣中',
      createdAt: '2026-05-14T00:00:00Z',
    },
  ],
};

const makeProps = (overrides: Partial<React.ComponentProps<typeof MerchantSheet>> = {}) => ({
  visible: true,
  merchant: baseMerchant,
  onClose: jest.fn(),
  onUseCoupon: jest.fn(),
  onClaimSharedCoupon: jest.fn(),
  onScanQR: jest.fn(),
  ...overrides,
});

describe('MerchantSheet', () => {
  it('renders nothing when merchant is null', () => {
    const { queryByTestId } = render(<MerchantSheet {...makeProps({ merchant: null })} />);
    expect(queryByTestId('merchant-sheet')).toBeNull();
  });

  it('renders the merchant name and meta line', () => {
    const { getByText } = render(<MerchantSheet {...makeProps()} />);
    expect(getByText('阿明早餐店')).toBeTruthy();
    expect(getByText(/忠孝東路 3 段/)).toBeTruthy();
    expect(getByText(/0\.3 km/)).toBeTruthy();
  });

  it('renders my-coupon tiles and calls onUseCoupon when tapped', () => {
    const onUseCoupon = jest.fn();
    const { getByTestId } = render(<MerchantSheet {...makeProps({ onUseCoupon })} />);
    fireEvent.press(getByTestId('my-coupon-mc1'));
    expect(onUseCoupon).toHaveBeenCalledWith(baseMerchant.myCoupons[0]);
  });

  it('renders all shared coupons in a horizontal carousel (no +N tile)', () => {
    const { getByTestId, queryByTestId } = render(<MerchantSheet {...makeProps()} />);
    expect(getByTestId('shared-coupons-carousel')).toBeTruthy();
    // All 5 mock shared coupons are present in the scroll view
    expect(getByTestId('shared-coupon-0')).toBeTruthy();
    expect(getByTestId('shared-coupon-4')).toBeTruthy();
    expect(queryByTestId('shared-coupon-more')).toBeNull();
  });

  it('shared coupon tap calls onClaimSharedCoupon with that coupon', () => {
    const onClaimSharedCoupon = jest.fn();
    const { getByTestId } = render(<MerchantSheet {...makeProps({ onClaimSharedCoupon })} />);
    fireEvent.press(getByTestId('shared-coupon-0'));
    expect(onClaimSharedCoupon).toHaveBeenCalledWith(baseMerchant.sharedCoupons[0]);
  });

  it('all overflow coupons remain tappable in the carousel', () => {
    const onClaimSharedCoupon = jest.fn();
    const { getByTestId } = render(<MerchantSheet {...makeProps({ onClaimSharedCoupon })} />);
    // Index 4 is the last of 5 — was previously hidden behind +N
    fireEvent.press(getByTestId('shared-coupon-4'));
    expect(onClaimSharedCoupon).toHaveBeenCalledWith(baseMerchant.sharedCoupons[4]);
  });

  it('renders my-coupons carousel container', () => {
    const { getByTestId } = render(<MerchantSheet {...makeProps()} />);
    expect(getByTestId('my-coupons-carousel')).toBeTruthy();
  });

  it('renders merchant news row with body text', () => {
    const { getByTestId, getByText } = render(<MerchantSheet {...makeProps()} />);
    expect(getByTestId('merchant-news')).toBeTruthy();
    expect(getByText(/起司蛋餅/)).toBeTruthy();
  });

  it('omits news row when no news entries', () => {
    const merchant: MerchantDetail = { ...baseMerchant, news: [] };
    const { queryByTestId } = render(<MerchantSheet {...makeProps({ merchant })} />);
    expect(queryByTestId('merchant-news')).toBeNull();
  });

  it('shows empty state when no my-coupons', () => {
    const merchant: MerchantDetail = { ...baseMerchant, myCoupons: [] };
    const { getByText } = render(<MerchantSheet {...makeProps({ merchant })} />);
    expect(getByText('尚無可使用的優惠券')).toBeTruthy();
  });

  it('shows empty state when no shared coupons', () => {
    const merchant: MerchantDetail = { ...baseMerchant, sharedCoupons: [] };
    const { getByText } = render(<MerchantSheet {...makeProps({ merchant })} />);
    expect(getByText('目前沒有人在 CouMap 分享優惠')).toBeTruthy();
  });

  it('claim CTA button calls onScanQR', () => {
    const onScanQR = jest.fn();
    const { getByTestId } = render(<MerchantSheet {...makeProps({ onScanQR })} />);
    fireEvent.press(getByTestId('merchant-sheet-scan'));
    expect(onScanQR).toHaveBeenCalledTimes(1);
  });
});
