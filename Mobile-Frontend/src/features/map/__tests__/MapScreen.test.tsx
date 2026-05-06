import React from 'react';
import { render } from '@testing-library/react-native';
import MapScreen from '../MapScreen';

// Mock icon components that use react-native-svg
jest.mock('@/src/components/icons/LogoIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, null) };
});
jest.mock('@/src/components/icons/SettingsIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, null) };
});
jest.mock('@/src/components/icons/GemIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, null) };
});
jest.mock('@/src/components/icons/CoinIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, null) };
});

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: 'map-view' }, children);
  const Marker = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: 'map-marker' }, children);
  return { __esModule: true, default: MapView, Marker };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const SvgView = ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children);
  return {
    __esModule: true,
    default: SvgView,
    Svg: SvgView,
    Path: () => null,
    Circle: () => null,
    Line: () => null,
    Rect: () => null,
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

const defaultProps = {
  onNavigate: jest.fn(),
  gems: 3,
  couPoints: 420,
};

describe('MapScreen', () => {
  it('renders without crash', () => {
    const { toJSON } = render(<MapScreen {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders correct number of markers', () => {
    const { getAllByTestId } = render(<MapScreen {...defaultProps} />);
    // 7 merchants in SAMPLE_MERCHANTS
    const markers = getAllByTestId('map-marker');
    expect(markers.length).toBe(7);
  });
});
