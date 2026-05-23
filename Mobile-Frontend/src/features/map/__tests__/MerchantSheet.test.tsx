import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MerchantSheet from '../MerchantSheet';
import type { MerchantDetail } from '@/src/services/api/merchants';

// Gorhom's bottom sheet uses native gestures + reanimated worklets that
// don't run cleanly in jsdom. Stub the surface area we use so the unit
// tests exercise our content layout, not the sheet animation library.
// `present` and `dismiss` are tracked jest.fn()s so tests can assert
// the gorhom prop bridge calls them at the right times.
const mockGorhomPresent = jest.fn();
const mockGorhomDismiss = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, ScrollView } = require('react-native');
  const BottomSheetModal = React.forwardRef(
    (
      { children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void },
      ref: React.MutableRefObject<unknown>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        present: mockGorhomPresent,
        dismiss: () => {
          mockGorhomDismiss();
          onDismiss?.();
        },
      }));
      return React.createElement(View, { testID: 'bottom-sheet-modal' }, children);
    },
  );
  const BottomSheetScrollView = ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
  } & Record<string, unknown>) => React.createElement(ScrollView, rest, children);
  const BottomSheetBackdrop = () => null;
  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetScrollView,
    BottomSheetBackdrop,
    BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

beforeEach(() => {
  mockGorhomPresent.mockClear();
  mockGorhomDismiss.mockClear();
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
  it('dismisses when merchant is null', () => {
    render(<MerchantSheet {...makeProps({ merchant: null })} />);
    expect(mockGorhomPresent).not.toHaveBeenCalled();
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

  it('renders SVG flag/block icons (not emoji) for the moderation actions', () => {
    // Neo-brutalism: SVG with strokes, not emoji glyphs that depend on the
    // device font. testIDs are stable selectors; existing tests pass `onFlag`
    // and `onBlock` so the buttons exist.
    const { getByTestId, queryByText } = render(
      <MerchantSheet {...makeProps({ onFlag: jest.fn(), onBlock: jest.fn() })} />,
    );
    expect(getByTestId('merchant-sheet-flag-icon')).toBeTruthy();
    expect(getByTestId('merchant-sheet-block-icon')).toBeTruthy();
    // Old emoji glyphs must be gone.
    expect(queryByText('⚑')).toBeNull();
    expect(queryByText('🚫')).toBeNull();
  });

  it('wraps the sheet body in a vertical ScrollView so long content can scroll', () => {
    // Bugfix: the sheet was a static View. When myCoupons + sharedCoupons +
    // news pushed past the visible height, the user could only close the
    // sheet — no scroll. Wrap the body in a ScrollView with a stable testID.
    const { getByTestId } = render(<MerchantSheet {...makeProps()} />);
    expect(getByTestId('merchant-sheet-scroll')).toBeTruthy();
  });

  it('renders the user own outstanding public shares as a read-only section', () => {
    // After a coupon is shared to CouMap, the BE excludes the sharer
    // from the public sharedCoupons list (self-claim is blocked). To
    // give the sharer visible confirmation, the sheet shows their own
    // outstanding shares in a separate read-only section that does NOT
    // wire onClaimSharedCoupon — tapping it must not call the handler.
    const onClaim = jest.fn();
    const merchant: MerchantDetail = {
      ...baseMerchant,
      myPublicShares: [
        { store: '阿明早餐店', amount: 12, sharer: '我', msg: '', label: '折抵' },
      ],
    };
    const { getByTestId } = render(
      <MerchantSheet {...makeProps({ merchant, onClaimSharedCoupon: onClaim })} />,
    );
    const tile = getByTestId('my-public-share-0');
    expect(tile).toBeTruthy();
    fireEvent.press(tile);
    expect(onClaim).not.toHaveBeenCalled();
  });

  it('omits the own-shares section when there are none', () => {
    const merchant: MerchantDetail = { ...baseMerchant, myPublicShares: [] };
    const { queryByTestId } = render(<MerchantSheet {...makeProps({ merchant })} />);
    expect(queryByTestId('my-public-share-0')).toBeNull();
  });

  it('calls gorhom.present() when visible becomes true with a merchant', () => {
    render(<MerchantSheet {...makeProps({ visible: true })} />);
    expect(mockGorhomPresent).toHaveBeenCalled();
  });

  it('calls gorhom.dismiss() when visible flips to false', () => {
    // The bridge must dismiss the modal through the imperative API
    // rather than unmounting it — unmounting strands gorhom's portal
    // and leaves the backdrop on screen.
    const { rerender } = render(<MerchantSheet {...makeProps({ visible: true })} />);
    mockGorhomPresent.mockClear();
    rerender(<MerchantSheet {...makeProps({ visible: false })} />);
    expect(mockGorhomDismiss).toHaveBeenCalled();
  });

  it('keeps the BottomSheetModal mounted even when merchant becomes null', () => {
    // Regression: an earlier version early-returned <></> when merchant
    // was null, which unmounted the modal mid-animation and left the
    // backdrop stranded. The sheet must stay mounted and call
    // dismiss() through the imperative API instead.
    const { rerender, getByTestId } = render(
      <MerchantSheet {...makeProps({ visible: true })} />,
    );
    expect(getByTestId('bottom-sheet-modal')).toBeTruthy();
    rerender(<MerchantSheet {...makeProps({ visible: false, merchant: null })} />);
    expect(getByTestId('bottom-sheet-modal')).toBeTruthy();
    expect(mockGorhomDismiss).toHaveBeenCalled();
  });
});
