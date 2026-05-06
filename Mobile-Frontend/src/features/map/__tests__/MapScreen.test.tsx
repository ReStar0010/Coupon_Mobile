import React from 'react';
import { render } from '@testing-library/react-native';
import MapScreen from '../MapScreen';

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const MapView = ({ children }: { children?: React.ReactNode }) => (
    <View testID="map-view">{children}</View>
  );
  const Marker = ({ children }: { children?: React.ReactNode }) => (
    <View testID="map-marker">{children}</View>
  );
  return { default: MapView, Marker };
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
