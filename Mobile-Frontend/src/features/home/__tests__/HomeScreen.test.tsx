import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';
import type { Coupon } from '../../../services/api/coupons';

// ── WalletContext mock ───────────────────────────────────────────────────────
const mockRefreshWallet = jest.fn().mockResolvedValue(undefined);
let mockCoupons: Coupon[] = [];
jest.mock('../../../state/WalletContext', () => ({
  useWallet: () => ({
    coupons: mockCoupons,
    refreshWallet: mockRefreshWallet,
  }),
}));

// ── coupons API mock ─────────────────────────────────────────────────────────
// HomeScreen fetches public shares + daily-draw status on mount; stub both so
// no real request leaks past test teardown.
jest.mock('../../../services/api/coupons', () => ({
  listMyPublicShares: jest.fn().mockResolvedValue([]),
  withdrawShare: jest.fn().mockResolvedValue(undefined),
  getDailyDrawStatus: jest.fn().mockResolvedValue({ canDrawToday: true, lastDrawDate: null }),
}));

const SAMPLE_COUPONS: Coupon[] = [
  {
    id: '1',
    store: '阿明早餐店',
    detail: '$25 現金折抵',
    expires: '11/08',
    amount: 25,
    status: 'active',
  },
  {
    id: '2',
    store: '手沖小巷',
    detail: '$10 現金折抵',
    expires: '11/30',
    amount: 10,
    status: 'active',
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
});
