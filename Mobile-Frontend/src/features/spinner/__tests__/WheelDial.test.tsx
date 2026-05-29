import React from 'react';
import { render } from '@testing-library/react-native';
import WheelDial from '../WheelDial';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mockComponent = (name: string) => {
    const Comp = ({ children, testID, ...props }: any) =>
      React.createElement(View, { testID: testID ?? name, ...props }, children);
    Comp.displayName = name;
    return Comp;
  };
  return {
    __esModule: true,
    default: mockComponent('Svg'),
    Svg: mockComponent('Svg'),
    Path: mockComponent('Path'),
    Circle: mockComponent('Circle'),
    Line: mockComponent('Line'),
    G: mockComponent('G'),
    Text: mockComponent('SvgText'),
    Polygon: mockComponent('Polygon'),
    Rect: mockComponent('Rect'),
  };
});

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return Reanimated;
});

describe('WheelDial', () => {
  it('renders without crash', () => {
    const { toJSON } = render(
      <WheelDial size={260} floor={0} spin={0} spinning={false} gems={1} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders correct number of sectors for floor=0 (6 multipliers)', () => {
    const { getAllByTestId } = render(
      <WheelDial size={260} floor={0} spin={0} spinning={false} gems={1} />
    );
    const sectors = getAllByTestId('wheel-sector');
    expect(sectors).toHaveLength(6);
  });

  it('renders fewer sectors for floor=3 (3 multipliers: x3, x4, x5)', () => {
    const { getAllByTestId } = render(
      <WheelDial size={260} floor={3} spin={0} spinning={false} gems={3} />
    );
    const sectors = getAllByTestId('wheel-sector');
    expect(sectors).toHaveLength(3);
  });

  it('renders default size when no size prop given', () => {
    const { toJSON } = render(
      <WheelDial spin={0} spinning={false} gems={1} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with high gem count for purple rim', () => {
    const { toJSON } = render(
      <WheelDial size={260} floor={0} spin={180} spinning={true} gems={5} />
    );
    expect(toJSON()).toBeTruthy();
  });
});
