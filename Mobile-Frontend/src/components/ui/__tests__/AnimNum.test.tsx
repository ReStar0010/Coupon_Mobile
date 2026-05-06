import React from 'react';
import { render, act } from '@testing-library/react-native';
import AnimNum from '../AnimNum';

describe('AnimNum', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders with initial value', () => {
    const { getByText } = render(<AnimNum value={42} />);
    expect(getByText('42')).toBeTruthy();
  });

  it('renders with zero', () => {
    const { getByText } = render(<AnimNum value={0} />);
    expect(getByText('0')).toBeTruthy();
  });

  it('renders with negative value', () => {
    const { getByText } = render(<AnimNum value={-5} />);
    expect(getByText('-5')).toBeTruthy();
  });

  it('updates displayed value when prop changes', () => {
    const { getByText, rerender } = render(<AnimNum value={10} />);
    expect(getByText('10')).toBeTruthy();

    act(() => {
      rerender(<AnimNum value={15} />);
    });

    // Advance enough timers for 5 steps (10→15) at 40ms each = 200ms minimum
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(getByText('15')).toBeTruthy();
  });

  it('handles large values', () => {
    const { getByText } = render(<AnimNum value={1000} />);
    expect(getByText('1000')).toBeTruthy();
  });
});
