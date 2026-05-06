import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NeoButton from '../NeoButton';

describe('NeoButton', () => {
  it('renders with label', () => {
    const { getByText } = render(
      <NeoButton label="Click Me" onPress={() => {}} />
    );
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('renders primary variant by default', () => {
    const { toJSON } = render(
      <NeoButton label="Primary" onPress={() => {}} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders secondary variant', () => {
    const { toJSON } = render(
      <NeoButton label="Secondary" onPress={() => {}} variant="secondary" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders danger variant', () => {
    const { toJSON } = render(
      <NeoButton label="Danger" onPress={() => {}} variant="danger" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders ghost variant', () => {
    const { toJSON } = render(
      <NeoButton label="Ghost" onPress={() => {}} variant="ghost" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('fires onPress callback when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <NeoButton label="Press" onPress={onPress} />
    );
    fireEvent.press(getByText('Press'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <NeoButton label="Disabled" onPress={onPress} disabled />
    );
    fireEvent.press(getByText('Disabled'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders fullWidth', () => {
    const { toJSON } = render(
      <NeoButton label="Full" onPress={() => {}} fullWidth />
    );
    expect(toJSON()).toBeTruthy();
  });
});
