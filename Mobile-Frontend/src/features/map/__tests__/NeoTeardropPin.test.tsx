import React from 'react';
import { render } from '@testing-library/react-native';
import NeoTeardropPin from '../NeoTeardropPin';

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = ({ children }: { children?: React.ReactNode }) => React.createElement(View, { testID: 'map-view' }, children);
  const Marker = ({ children }: { children?: React.ReactNode }) => React.createElement(View, { testID: 'map-marker' }, children);
  MapView.default = MapView;
  return { __esModule: true, default: MapView, Marker };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children),
    Svg: ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children),
    Path: () => null,
    Circle: () => null,
    Text: ({ children }: { children?: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const AnimatedView = ({ children, style }: { children?: React.ReactNode; style?: object }) =>
    React.createElement(View, { style }, children);
  return {
    __esModule: true,
    default: {
      View: AnimatedView,
      createAnimatedComponent: (C: React.ComponentType) => C,
    },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withRepeat: (v: unknown) => v,
    withSequence: (...args: unknown[]) => args[0],
    withTiming: (v: unknown) => v,
  };
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
