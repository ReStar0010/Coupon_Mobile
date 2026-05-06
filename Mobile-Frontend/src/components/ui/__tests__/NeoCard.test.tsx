import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import NeoCard from '../NeoCard';
import { colors } from '../../../theme/colors';

describe('NeoCard', () => {
  it('renders children', () => {
    const { getByText } = render(
      <NeoCard>
        <Text>Hello Card</Text>
      </NeoCard>
    );
    expect(getByText('Hello Card')).toBeTruthy();
  });

  it('renders with default props without error', () => {
    const { toJSON } = render(
      <NeoCard>
        <Text>Content</Text>
      </NeoCard>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('accepts custom shadowOffset', () => {
    const { toJSON } = render(
      <NeoCard shadowOffset={8}>
        <Text>Content</Text>
      </NeoCard>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('accepts custom backgroundColor', () => {
    const { toJSON } = render(
      <NeoCard backgroundColor={colors.yellowLight}>
        <Text>Content</Text>
      </NeoCard>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('accepts custom borderRadius', () => {
    const { toJSON } = render(
      <NeoCard borderRadius={12}>
        <Text>Content</Text>
      </NeoCard>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('accepts style prop', () => {
    const { toJSON } = render(
      <NeoCard style={{ margin: 16 }}>
        <Text>Content</Text>
      </NeoCard>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders multiple children', () => {
    const { getByText } = render(
      <NeoCard>
        <Text>First</Text>
        <Text>Second</Text>
      </NeoCard>
    );
    expect(getByText('First')).toBeTruthy();
    expect(getByText('Second')).toBeTruthy();
  });
});
