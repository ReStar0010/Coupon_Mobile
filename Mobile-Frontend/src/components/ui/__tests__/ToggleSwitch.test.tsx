import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ToggleSwitch from '../ToggleSwitch';

describe('ToggleSwitch', () => {
  it('renders in off state', () => {
    const { toJSON } = render(
      <ToggleSwitch value={false} onToggle={() => {}} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders in on state', () => {
    const { toJSON } = render(
      <ToggleSwitch value={true} onToggle={() => {}} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('calls onToggle with true when toggled from off', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <ToggleSwitch value={false} onToggle={onToggle} />
    );
    fireEvent.press(getByTestId('toggle-switch'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('calls onToggle with false when toggled from on', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <ToggleSwitch value={true} onToggle={onToggle} />
    );
    fireEvent.press(getByTestId('toggle-switch'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('calls onToggle once per press', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <ToggleSwitch value={false} onToggle={onToggle} />
    );
    fireEvent.press(getByTestId('toggle-switch'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
