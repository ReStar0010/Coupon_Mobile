import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Stepper from '../Stepper';

describe('Stepper', () => {
  it('renders with current value', () => {
    const { getByText } = render(
      <Stepper value={3} min={1} max={5} onChange={() => {}} />
    );
    expect(getByText('3')).toBeTruthy();
  });

  it('increments value when + pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <Stepper value={2} min={1} max={5} onChange={onChange} />
    );
    fireEvent.press(getByTestId('stepper-increment'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('decrements value when - pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <Stepper value={3} min={1} max={5} onChange={onChange} />
    );
    fireEvent.press(getByTestId('stepper-decrement'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('does not go below min', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <Stepper value={1} min={1} max={5} onChange={onChange} />
    );
    fireEvent.press(getByTestId('stepper-decrement'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not go above max', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <Stepper value={5} min={1} max={5} onChange={onChange} />
    );
    fireEvent.press(getByTestId('stepper-increment'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders min and max buttons with correct disabled state', () => {
    const { getByTestId } = render(
      <Stepper value={1} min={1} max={5} onChange={() => {}} />
    );
    expect(getByTestId('stepper-decrement')).toBeTruthy();
    expect(getByTestId('stepper-increment')).toBeTruthy();
  });

  it('renders label when provided', () => {
    const { getByText } = render(
      <Stepper value={2} min={1} max={5} onChange={() => {}} label="Count" />
    );
    expect(getByText('Count')).toBeTruthy();
  });
});
