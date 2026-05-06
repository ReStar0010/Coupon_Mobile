import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';

const makeProps = (overrides = {}) => ({
  onNavigate: jest.fn(),
  gems: 3,
  setGems: jest.fn(),
  couPoints: 98,
  setCouPoints: jest.fn(),
  ...overrides,
});

describe('HomeScreen', () => {
  it('renders header with logo and title', () => {
    const { getByText } = render(<HomeScreen {...makeProps()} />);
    expect(getByText('CouPro')).toBeTruthy();
  });

  it('renders CouPoints balance', () => {
    const { getByTestId } = render(<HomeScreen {...makeProps({ couPoints: 98 })} />);
    expect(getByTestId('coupoints-balance')).toBeTruthy();
  });

  it('renders coupon list items', () => {
    const { getAllByTestId } = render(<HomeScreen {...makeProps()} />);
    const rows = getAllByTestId('coupon-row');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('tapping a coupon row calls onNavigate with coupon-detail', () => {
    const onNavigate = jest.fn();
    const { getAllByTestId } = render(<HomeScreen {...makeProps({ onNavigate })} />);
    fireEvent.press(getAllByTestId('coupon-row')[0]);
    expect(onNavigate).toHaveBeenCalledWith('coupon-detail', expect.any(Object));
  });

  it('tapping settings calls onNavigate with settings', () => {
    const onNavigate = jest.fn();
    const { getByTestId } = render(<HomeScreen {...makeProps({ onNavigate })} />);
    fireEvent.press(getByTestId('settings-btn'));
    expect(onNavigate).toHaveBeenCalledWith('settings');
  });
});
