import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CouponDetailScreen from '../CouponDetailScreen';

const mockGetCoupon = jest.fn();

jest.mock('../../../services/api/coupons', () => ({
  getCoupon: (...args: unknown[]) => mockGetCoupon(...args),
}));

const makeProps = (overrides = {}) => ({
  onNavigate: jest.fn(),
  gems: 3,
  setGems: jest.fn(),
  couPoints: 98,
  setCouPoints: jest.fn(),
  params: {
    store: '阿明早餐店',
    detail: '$25 現金折抵',
    expires: '11/08',
    amount: 25,
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CouponDetailScreen', () => {
  it('renders store name and amount from params when no id is present', () => {
    const { getByText } = render(<CouponDetailScreen {...makeProps()} />);
    expect(getByText('阿明早餐店')).toBeTruthy();
    expect(getByText('25')).toBeTruthy();
    expect(mockGetCoupon).not.toHaveBeenCalled();
  });

  it('tapping share button calls onNavigate with coupon-share', () => {
    const onNavigate = jest.fn();
    const { getByTestId } = render(<CouponDetailScreen {...makeProps({ onNavigate })} />);
    fireEvent.press(getByTestId('share-btn'));
    expect(onNavigate).toHaveBeenCalledWith(
      'coupon-share',
      expect.objectContaining({ store: '阿明早餐店' }),
    );
  });

  it('tapping QR button calls onNavigate with coupon-qr', () => {
    const onNavigate = jest.fn();
    const { getByTestId } = render(<CouponDetailScreen {...makeProps({ onNavigate })} />);
    fireEvent.press(getByTestId('use-btn'));
    expect(onNavigate).toHaveBeenCalledWith('coupon-qr', expect.objectContaining({ amount: 25 }));
  });

  it('calls getCoupon on mount when params.id is present', async () => {
    mockGetCoupon.mockResolvedValueOnce({
      id: 'c-42',
      store: 'Fetched Store',
      detail: '$50 off',
      expires: '12/24',
      amount: 50,
      status: 'active',
    });

    const props = makeProps({ params: { id: 'c-42' } });
    const { getByText } = render(<CouponDetailScreen {...props} />);

    await waitFor(() => {
      expect(mockGetCoupon).toHaveBeenCalledWith('c-42');
    });
    await waitFor(() => {
      expect(getByText('Fetched Store')).toBeTruthy();
    });
  });

  it('shows the error banner when getCoupon fails', async () => {
    mockGetCoupon.mockRejectedValueOnce(new Error('boom'));

    const props = makeProps({ params: { id: 'c-bad' } });
    const { getByTestId } = render(<CouponDetailScreen {...props} />);

    await waitFor(() => {
      expect(getByTestId('coupon-detail-error')).toBeTruthy();
    });
  });
});
