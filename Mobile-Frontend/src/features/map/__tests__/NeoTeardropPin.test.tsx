import React from 'react';
import { render } from '@testing-library/react-native';
import NeoTeardropPin from '../NeoTeardropPin';

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const Marker = ({ children }: { children?: React.ReactNode }) => <View testID="map-marker">{children}</View>;
  return { Marker };
});

jest.mock('react-native-svg', () => {
  const { View, Text } = require('react-native');
  return {
    Svg: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    Path: () => null,
    Circle: () => null,
    Text: ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const Animated = {
    View,
    createAnimatedComponent: (C: React.ComponentType) => C,
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withRepeat: (v: unknown) => v,
    withSequence: (...args: unknown[]) => args[0],
    withTiming: (v: unknown) => v,
  };
  return { default: Animated, ...Animated };
});

const coord = { latitude: 25.0478, longitude: 121.5318 };

describe('NeoTeardropPin', () => {
  it('renders without crash', () => {
    const { toJSON } = render(
      <NeoTeardropPin coordinate={coord} active={false} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('shows count when active and count provided', () => {
    const { getByText } = render(
      <NeoTeardropPin coordinate={coord} active count={5} />,
    );
    expect(getByText('5')).toBeTruthy();
  });

  it('does not show count when inactive', () => {
    const { queryByText } = render(
      <NeoTeardropPin coordinate={coord} active={false} count={5} />,
    );
    expect(queryByText('5')).toBeNull();
  });
});
