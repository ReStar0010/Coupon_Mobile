import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CouponShareScreen from '../CouponShareScreen';

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

describe('CouponShareScreen', () => {
  it('share button is disabled when no target selected', () => {
    const { getByTestId } = render(<CouponShareScreen {...makeProps()} />);
    const btn = getByTestId('confirm-btn');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('selecting a target enables the share button', () => {
    const { getByTestId } = render(<CouponShareScreen {...makeProps()} />);
    fireEvent.press(getByTestId('target-map'));
    const btn = getByTestId('confirm-btn');
    expect(btn.props.accessibilityState?.disabled).toBe(false);
  });

  it('confirm navigates home after selecting target', () => {
    jest.useFakeTimers();
    const onNavigate = jest.fn();
    const setGems = jest.fn();
    const { getByTestId } = render(
      <CouponShareScreen {...makeProps({ onNavigate, setGems })} />
    );
    fireEvent.press(getByTestId('target-map'));
    fireEvent.press(getByTestId('confirm-btn'));
    expect(setGems).toHaveBeenCalled();
    jest.advanceTimersByTime(3000);
    expect(onNavigate).toHaveBeenCalledWith('home');
    jest.useRealTimers();
  });
});
