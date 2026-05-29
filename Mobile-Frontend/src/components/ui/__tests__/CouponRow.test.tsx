import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CouponRow from '../CouponRow';

describe('CouponRow', () => {
  const defaultProps = {
    store: '阿明早餐店',
    detail: '$25 現金折抵',
    expires: '11/08',
    amount: 25,
    onPress: jest.fn(),
  };

  it('renders store name', () => {
    const { getByText } = render(<CouponRow {...defaultProps} />);
    expect(getByText('阿明早餐店')).toBeTruthy();
  });

  it('renders detail text', () => {
    const { getByText } = render(<CouponRow {...defaultProps} />);
    expect(getByText('$25 現金折抵')).toBeTruthy();
  });

  it('renders expiry date', () => {
    const { getByText } = render(<CouponRow {...defaultProps} />);
    expect(getByText(/11\/08/)).toBeTruthy();
  });

  it('calls onPress when row is pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <CouponRow {...defaultProps} onPress={onPress} />
    );
    fireEvent.press(getByTestId('coupon-row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without onShare prop', () => {
    const { toJSON } = render(
      <CouponRow
        store="Store"
        detail="Detail"
        expires="12/31"
        amount={10}
        onPress={() => {}}
      />
    );
    expect(toJSON()).toBeTruthy();
  });
});
