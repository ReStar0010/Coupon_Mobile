import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CouponDetailScreen from '../CouponDetailScreen';

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

describe('CouponDetailScreen', () => {
  it('renders store name and amount', () => {
    const { getByText } = render(<CouponDetailScreen {...makeProps()} />);
    expect(getByText('阿明早餐店')).toBeTruthy();
    expect(getByText('25')).toBeTruthy();
  });

  it('tapping share button calls onNavigate with coupon-share', () => {
    const onNavigate = jest.fn();
    const { getByTestId } = render(<CouponDetailScreen {...makeProps({ onNavigate })} />);
    fireEvent.press(getByTestId('share-btn'));
    expect(onNavigate).toHaveBeenCalledWith('coupon-share', expect.objectContaining({ store: '阿明早餐店' }));
  });

  it('tapping QR button calls onNavigate with coupon-qr', () => {
    const onNavigate = jest.fn();
    const { getByTestId } = render(<CouponDetailScreen {...makeProps({ onNavigate })} />);
    fireEvent.press(getByTestId('use-btn'));
    expect(onNavigate).toHaveBeenCalledWith('coupon-qr', expect.objectContaining({ amount: 25 }));
  });
});
